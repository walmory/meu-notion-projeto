'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
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
    if (isOpen) {
      // Reset forms
      setNewEmail('');
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
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Failed to update profile', error);
      if (user) setUser(user);
      toast.error('Erro ao atualizar perfil. Tente novamente.');
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
      toast.success('E-mail atualizado com sucesso!');
      setNewEmail('');
      setCurrentPasswordForEmail('');
    } catch (error) {
      console.error('Failed to update email', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Erro ao atualizar e-mail.');
      } else {
        toast.error('Erro ao atualizar e-mail.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      toast.error('As novas senhas não coincidem.');
      return;
    }

    setPasswordLoading(true);

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/update-password',
        { currentPassword, newPassword },
        { headers: getAuthHeaders() }
      );
      
      toast.success('Senha atualizada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to update password', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Erro ao atualizar senha.');
      } else {
        toast.error('Erro ao atualizar senha.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-white">Configurações</DialogTitle>
          <DialogDescription className="text-[#9b9b9b]">
            Gerencie seu perfil, e-mail e senha de acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-10 py-2">
          {/* Form de Perfil */}
          <section>
            <h3 className="text-lg font-medium text-white mb-4">Perfil Público</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-white">Nome</label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
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
                  placeholder="Fale um pouco sobre você"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="avatarUrl" className="text-sm font-medium text-white">URL do Avatar</label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://exemplo.com/avatar.jpg"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={loading || fetching || !name.trim()}
                  className="bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Atualizar Perfil
                </Button>
              </div>
            </form>
          </section>

          <div className="h-px bg-white/10" />

          {/* Form de Email */}
          <section>
            <h3 className="text-lg font-medium text-white mb-1">E-mail</h3>
            <DialogDescription className="text-[#9b9b9b] mb-4 text-xs">
              Confirme sua identidade usando sua senha atual para alterar.
            </DialogDescription>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="newEmail" className="text-sm font-medium text-white">Novo E-mail</label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="currentPasswordForEmail" className="text-sm font-medium text-white">Senha Atual</label>
                <Input
                  id="currentPasswordForEmail"
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  placeholder="Sua senha atual"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#9b9b9b]"
                  required
                />
              </div>
              
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim() || !currentPasswordForEmail}
                  className="bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Atualizar E-mail
                </Button>
              </div>
            </form>
          </section>

          <div className="h-px bg-white/10" />

          {/* Form de Senha */}
          <section>
            <h3 className="text-lg font-medium text-white mb-1">Senha</h3>
            <DialogDescription className="text-[#9b9b9b] mb-4 text-xs">
              Confirme a senha atual por segurança.
            </DialogDescription>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium text-white">Senha Atual</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium text-white">Nova Senha</label>
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
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-white">Confirmar Senha</label>
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
              </div>
              
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Atualizar Senha
                </Button>
              </div>
            </form>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
