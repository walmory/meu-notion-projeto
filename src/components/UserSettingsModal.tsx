'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@/contexts/UserContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { user, refreshUser, setUser } = useUser();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Account states
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage('');
      setErrorMessage('');
      setEmailSuccess('');
      setEmailError('');
      setPasswordSuccess('');
      setPasswordError('');
      setCurrentPasswordForEmail('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
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
    }
  }, [isOpen, user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // 2. Optimistic UI / Pulo do Gato: Atualiza o estado global ANTES da API responder
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
      
      // O refreshUser já não é tão urgente porque a UI já atualizou, mas mantemos para garantir consistência
      await refreshUser(); 
      
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to update profile', error);
      // Rollback
      if (user) setUser(user);
      setErrorMessage('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !currentPasswordForEmail) return;

    setEmailLoading(true);
    setEmailSuccess('');
    setEmailError('');

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/update-email',
        { newEmail, currentPassword: currentPasswordForEmail },
        { headers: getAuthHeaders() }
      );
      
      await refreshUser();
      setEmailSuccess('Email updated successfully!');
      setTimeout(() => {
        setEmailSuccess('');
        setCurrentPasswordForEmail('');
      }, 3000);
    } catch (error) {
      console.error('Failed to update email', error);
      if (axios.isAxiosError(error)) {
        setEmailError(error.response?.data?.error || 'Failed to update email.');
      } else {
        setEmailError('Failed to update email.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      setPasswordError('As novas senhas não coincidem.');
      return;
    }

    setPasswordLoading(true);
    setPasswordSuccess('');
    setPasswordError('');

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/update-password',
        { currentPassword, newPassword },
        { headers: getAuthHeaders() }
      );
      
      setPasswordSuccess('Password updated successfully!');
      setTimeout(() => {
        setPasswordSuccess('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 3000);
    } catch (error) {
      console.error('Failed to update password', error);
      if (axios.isAxiosError(error)) {
        setPasswordError(error.response?.data?.error || 'Failed to update password.');
      } else {
        setPasswordError('Failed to update password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
        <Tabs defaultValue="profile" className="w-full">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white">Settings</DialogTitle>
            <TabsList className="grid w-full grid-cols-2 bg-[#262626]">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <TabsContent value="profile">
            <form onSubmit={handleUpdate}>
              <DialogDescription className="text-[#9b9b9b] mb-4">
                Update your personal information here.
              </DialogDescription>

              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-white">Name</label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="bio" className="text-sm font-medium text-white">Bio</label>
                  <Input
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="avatarUrl" className="text-sm font-medium text-white">Avatar URL</label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                  />
                </div>

                {errorMessage && <div className="text-sm text-red-500">{errorMessage}</div>}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-[#9b9b9b] hover:text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || fetching || !name.trim() || !!successMessage}
                  className={`text-black transition-all ${
                    successMessage 
                      ? "bg-green-500 hover:bg-green-600 text-white" 
                      : "bg-white hover:bg-gray-200"
                  }`}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {successMessage ? 'Success!' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="account">
            <div className="space-y-6">
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <DialogDescription className="text-[#9b9b9b]">
                  Change your email address. Confirme sua identidade, {user?.name || 'usuário'}.
                </DialogDescription>
                
                <div className="space-y-2">
                  <label htmlFor="newEmail" className="text-sm font-medium text-white">New Email</label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter your new email"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="currentPasswordForEmail" className="text-sm font-medium text-white">Current Password</label>
                  <Input
                    id="currentPasswordForEmail"
                    type="password"
                    value={currentPasswordForEmail}
                    onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                    placeholder="Confirme sua senha atual"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>

                {emailError && <div className="text-sm text-red-500">{emailError}</div>}
                
                <Button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim() || !currentPasswordForEmail || !!emailSuccess}
                  className={`w-full text-black transition-all ${
                    emailSuccess 
                      ? "bg-green-500 hover:bg-green-600 text-white" 
                      : "bg-white hover:bg-gray-200"
                  }`}
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {emailSuccess ? 'Success!' : 'Update Email'}
                </Button>
              </form>

              <div className="h-px bg-white/10" />

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <DialogDescription className="text-[#9b9b9b]">
                  Change your password. Confirme sua identidade, {user?.name || 'usuário'}.
                </DialogDescription>
                
                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-medium text-white">Current Password</label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Sua senha atual"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium text-white">New Password</label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Sua nova senha"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-white">Confirm New Password</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                    required
                  />
                </div>

                {passwordError && <div className="text-sm text-red-500">{passwordError}</div>}
                
                <Button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword || !!passwordSuccess}
                  className={`w-full text-black transition-all ${
                    passwordSuccess 
                      ? "bg-green-500 hover:bg-green-600 text-white" 
                      : "bg-white hover:bg-gray-200"
                  }`}
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {passwordSuccess ? 'Success!' : 'Update Password'}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
