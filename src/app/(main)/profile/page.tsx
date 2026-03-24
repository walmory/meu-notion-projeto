'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getAuthHeaders } from '@/lib/api';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Edit, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileData {
  name: string;
  email: string;
  bio: string;
  avatar_url: string;
}

export default function ProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('https://apinotion.andrekehrer.com/user/profile', {
          headers: getAuthHeaders()
        });
        setProfile(response.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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

      <div className="flex-1 max-w-[800px] w-full mx-auto px-8 sm:px-12 md:px-24 relative pb-24">
        {/* Avatar Section */}
        <div className="relative -mt-20 mb-6 flex justify-between items-end">
          <div className="w-32 h-32 rounded-full bg-[#262626] border-4 border-[#191919] flex items-center justify-center overflow-hidden shadow-xl">
            {displayData?.avatar_url ? (
              <img 
                src={displayData.avatar_url} 
                alt={displayData.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-5xl font-medium text-white">{initial}</span>
            )}
          </div>
          
          <Button 
            onClick={() => router.push('/settings')}
            variant="outline" 
            className="bg-[#262626] border-white/10 text-white hover:bg-[#333333] hover:text-white mb-2"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* User Info */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            {displayData?.name || 'User'}
          </h1>
          <div className="flex items-center text-[#a3a3a3] mb-6">
            <Mail className="w-4 h-4 mr-2" />
            <span className="text-sm">{displayData?.email || 'No email provided'}</span>
          </div>
          
          <div className="prose prose-invert max-w-none">
            {displayData?.bio ? (
              <p className="text-[#d4d4d4] text-lg leading-relaxed whitespace-pre-wrap">
                {displayData.bio}
              </p>
            ) : (
              <p className="text-[#525252] text-lg italic">
                No bio yet.
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10 w-full mb-12" />

        {/* Recent Activity Skeleton */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-6">Recent Activity</h2>
          
          <div className="space-y-4">
            {/* Empty State / Skeleton for now */}
            <div className="p-4 rounded-lg border border-white/5 bg-[#262626]/50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded bg-[#333333] animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-48 bg-[#333333] rounded animate-pulse" />
                  <div className="h-3 w-24 bg-[#333333] rounded animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg border border-white/5 bg-[#262626]/50 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded bg-[#333333] animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[#333333] rounded animate-pulse" />
                  <div className="h-3 w-20 bg-[#333333] rounded animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="text-center py-8">
              <p className="text-[#737373] text-sm">Activity feed coming soon...</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}