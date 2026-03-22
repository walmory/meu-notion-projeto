'use client';

import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface IconPickerProps {
  icon: string;
  onSelect: (iconName: string) => void;
  children: React.ReactNode;
}

// Uma lista curada de ícones úteis para teamspaces/projetos
const commonIcons = [
  'Users', 'Building', 'Briefcase', 'Globe', 'Folder', 'FolderOpen',
  'File', 'FileText', 'Book', 'BookOpen', 'Bookmark', 'Layers',
  'Layout', 'LayoutGrid', 'LayoutDashboard', 'Monitor', 'Smartphone',
  'Terminal', 'Cpu', 'Database', 'Server', 'Cloud', 'CloudLightning',
  'Code', 'TerminalSquare', 'Braces', 'Rocket', 'Zap',
  'Flame', 'Star', 'Heart', 'Award', 'Trophy', 'Crown', 'Target',
  'Flag', 'Crosshair', 'Compass', 'Map', 'MapPin', 'Navigation',
  'Box', 'Package', 'Archive', 'Inbox', 'Mail', 'MessageSquare',
  'MessageCircle', 'Phone', 'Video', 'Camera', 'Music',
  'Headphones', 'Mic', 'Radio', 'Tv', 'Speaker', 'Volume', 'Bell',
  'Megaphone', 'Eye', 'EyeOff', 'Search', 'ZoomIn', 'ZoomOut',
  'Settings', 'Tool', 'PenTool', 'Wrench', 'Hammer', 'Scissors',
  'Key', 'Lock', 'Unlock', 'Shield', 'ShieldAlert', 'ShieldCheck',
  'Coffee', 'CupSoda', 'Droplet', 'Umbrella', 'Wind', 'CloudRain',
  'Sun', 'Moon', 'Thermometer', 'Activity', 'Pulse', 'HeartPulse',
];

export function IconPicker({ icon, onSelect, children }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = commonIcons.filter(name => 
    name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-[#191919] border-white/5 text-white" align="start">
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9b9b9b]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="pl-8 bg-[#2c2c2c] border-none text-white h-8 text-sm placeholder:text-[#9b9b9b] focus-visible:ring-1 focus-visible:ring-white/20"
          />
        </div>
        <div className="grid grid-cols-6 gap-1 h-48 overflow-y-auto pr-1">
          {filteredIcons.map((iconName) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const IconComponent = (LucideIcons as any)[iconName];
            if (!IconComponent) return null;
            
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => {
                  onSelect(iconName);
                  setOpen(false);
                }}
                className={`flex items-center justify-center p-2 rounded hover:bg-[#3f3f3f] transition-colors ${
                  icon === iconName ? 'bg-[#2eaadc]/20 text-[#2eaadc]' : 'text-[#a3a3a3]'
                }`}
                title={iconName}
              >
                <IconComponent size={18} />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <div className="col-span-6 text-center text-sm text-[#9b9b9b] py-4">
              No icons found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}