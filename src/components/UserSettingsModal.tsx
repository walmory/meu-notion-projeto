'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuthHeaders, getUserFromToken } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import axios from 'axios';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const [name, setName] = useState('Victor Walmory');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage('');
      setErrorMessage('');
      
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
          // Fallback para o token caso a API falhe (ex: 404)
          const user = getUserFromToken();
          if (user?.name) setName(user.name);
        } finally {
          setFetching(false);
        }
      };
      
      fetchProfile();
    }
  }, [isOpen]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/profile',
        { name, bio, avatar_url: avatarUrl },
        { headers: getAuthHeaders() }
      );
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to update profile', error);
      setErrorMessage('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
        <form onSubmit={handleUpdate}>
          <DialogHeader>
            <DialogTitle className="text-white">Profile Settings</DialogTitle>
            <DialogDescription className="text-[#9b9b9b]">
              Update your personal information here.
            </DialogDescription>
          </DialogHeader>

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

            {successMessage && <div className="text-sm text-green-500">{successMessage}</div>}
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
              disabled={loading || fetching || !name.trim()}
              className="bg-white text-black hover:bg-gray-200"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
