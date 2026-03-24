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
      onClose();
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
      <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
        <Tabs defaultValue="profile" className="w-full">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-white">Configurações</DialogTitle>
            <TabsList className="grid w-full grid-cols-2 bg-[#262626] mt-4">
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="account">Conta</TabsTrigger>
            </TabsList>
          </DialogHeader>

          <TabsContent value="profile">
            <form onSubmit={handleUpdateProfile}>
              <DialogDescription className="text-[#9b9b9b] mb-4">
                Atualize suas informações pessoais aqui.
              </DialogDescription>

              <div className="py-4 space-y-4">
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-[#9b9b9b] hover:text-white hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || fetching || !name.trim()}
                  className="bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="account">
            <div className="space-y-6 py-2">
              {/* Form de Email */}
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <DialogDescription className="text-[#9b9b9b]">
                  Altere seu endereço de e-mail. Confirme sua identidade usando sua senha atual.
                </DialogDescription>
                
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
                
                <Button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim() || !currentPasswordForEmail}
                  className="w-full bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Atualizar E-mail
                </Button>
              </form>

              <div className="h-px bg-white/10 my-4" />

              {/* Form de Senha */}
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <DialogDescription className="text-[#9b9b9b]">
                  Altere sua senha de acesso. Confirme a senha atual por segurança.
                </DialogDescription>
                
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
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-white">Confirmar Nova Senha</label>
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
                
                <Button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-white hover:bg-gray-200 text-black transition-all"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Atualizar Senha
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
