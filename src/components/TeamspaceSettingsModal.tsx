'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Shield, UserPlus, LogOut, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getUserFromToken } from '@/lib/api';

interface TeamspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamspace: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate?: (updates: any) => void;
  onLeave?: () => void;
  onArchive?: () => void;
}

export function TeamspaceSettingsModal({
  isOpen,
  onClose,
  teamspace,
  onUpdate,
  onLeave,
  onArchive,
}: TeamspaceSettingsModalProps) {
  const [name, setName] = useState(teamspace?.name || '');
  const [description, setDescription] = useState(teamspace?.description || '');

  if (!teamspace) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[700px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-[200px] bg-[#191919] border-r border-white/5 p-4 flex flex-col gap-1">
            <div className="px-2 pb-4 pt-2">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {teamspace.name}
              </h3>
            </div>
            <Tabs defaultValue="general" className="w-full flex-1 flex flex-col" orientation="vertical">
              <TabsList className="flex flex-col bg-transparent h-auto p-0 items-start justify-start gap-1">
                <TabsTrigger 
                  value="general" 
                  className="w-full justify-start px-2 py-1.5 text-sm data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#a3a3a3] hover:bg-white/5"
                >
                  <Settings size={16} className="mr-2" />
                  General
                </TabsTrigger>
                <TabsTrigger 
                  value="members" 
                  className="w-full justify-start px-2 py-1.5 text-sm data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#a3a3a3] hover:bg-white/5"
                >
                  <Users size={16} className="mr-2" />
                  Members
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="w-full justify-start px-2 py-1.5 text-sm data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#a3a3a3] hover:bg-white/5"
                >
                  <Shield size={16} className="mr-2" />
                  Security
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            <Tabs defaultValue="general" className="w-full">
              <TabsContent value="general" className="m-0 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-6">General</h2>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="ts-name" className="text-xs font-medium text-[#9b9b9b]">Name</label>
                      <Input 
                        id="ts-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-[#2c2c2c] border-white/5 text-white max-w-md"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="ts-desc" className="text-xs font-medium text-[#9b9b9b]">Description</label>
                      <Input 
                        id="ts-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-[#2c2c2c] border-white/5 text-white max-w-md"
                      />
                    </div>

                    <Button className="bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white border border-white/5 mt-2 transition-colors">
                      Update
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h3 className="text-sm font-semibold text-white">Danger Zone</h3>
                  
                  <div className="flex items-center justify-between p-4 border border-[#eb5757]/20 rounded-lg bg-[#eb5757]/5">
                    <div>
                      <h4 className="text-sm font-medium text-white">Leave teamspace</h4>
                      <p className="text-xs text-[#9b9b9b]">You will lose access to all documents inside.</p>
                    </div>
                    <Button variant="outline" className="border-[#eb5757]/30 text-[#eb5757] hover:bg-[#eb5757]/10 hover:text-[#eb5757]">
                      <LogOut size={16} className="mr-2" />
                      Leave
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-[#eb5757]/20 rounded-lg bg-[#eb5757]/5">
                    <div>
                      <h4 className="text-sm font-medium text-white">Archive teamspace</h4>
                      <p className="text-xs text-[#9b9b9b]">Move to archive. Documents will be hidden.</p>
                    </div>
                    <Button variant="outline" className="border-[#eb5757]/30 text-[#eb5757] hover:bg-[#eb5757]/10 hover:text-[#eb5757]">
                      <Archive size={16} className="mr-2" />
                      Archive
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-[#eb5757]/20 rounded-lg bg-[#eb5757]/5">
                    <div>
                      <h4 className="text-sm font-medium text-white">Delete Workspace</h4>
                      <p className="text-xs text-[#9b9b9b]">Permanently delete this workspace and all its data.</p>
                    </div>
                    <Button variant="outline" className="border-[#eb5757]/30 text-[#eb5757] hover:bg-[#eb5757]/10 hover:text-[#eb5757]">
                      <LogOut size={16} className="mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="members" className="m-0 space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Members</h2>
                  <Button className="bg-[#2383e2] hover:bg-[#2383e2]/90 text-white h-8 text-sm">
                    <UserPlus size={16} className="mr-2" />
                    Add members
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-medium">
                        {getUserFromToken()?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{getUserFromToken()?.name || 'User'}</div>
                        <div className="text-xs text-[#9b9b9b]">{getUserFromToken()?.email || ''}</div>
                      </div>
                    </div>
                    <div className="text-sm text-[#9b9b9b] px-2 py-1 bg-white/5 rounded">
                      Owner
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="m-0 space-y-6">
                <h2 className="text-xl font-semibold text-white mb-6">Security</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Invite Members</h4>
                      <p className="text-xs text-[#9b9b9b]">Who can invite new members to this teamspace?</p>
                    </div>
                    <select className="bg-[#2c2c2c] border border-white/5 text-sm text-white rounded px-3 py-1.5 outline-none">
                      <option>Any member</option>
                      <option>Teamspace owners</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Public Links</h4>
                      <p className="text-xs text-[#9b9b9b]">Allow members to share pages to the web.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-[#3f3f3f] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2383e2]"></div>
                    </label>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
