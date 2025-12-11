import React, { useEffect, useState } from 'react';
import { Home, MessageCircleHeart, CalendarHeart, Image as ImageIcon, WifiOff } from 'lucide-react';
import { supabase } from '../supabase';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: any;
  unreadCount: number;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, unreadCount }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Monitor Supabase connection state
    const channel = supabase.channel('ping');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setIsConnected(true);
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-rose-50 text-slate-800 overflow-hidden font-sans">
      {/* Sync Status Indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 z-[60] transition-colors duration-500 ${isConnected ? 'bg-green-400/50' : 'bg-red-500'}`} />
      
      {!isConnected && (
         <div className="absolute top-1 right-1 z-[60] text-[10px] text-red-500 bg-white/80 px-2 py-0.5 rounded-full flex items-center gap-1">
            <WifiOff size={10} /> Offline
         </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24 relative">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md shadow-2xl rounded-3xl h-20 flex items-center justify-around z-50 border border-rose-100 px-2">
        <NavButton 
          icon={<Home size={24} />} 
          label="Home" 
          isActive={activeTab === 'dashboard'} 
          onClick={() => onTabChange('dashboard')} 
          color={currentUser?.theme_color}
        />
        <NavButton 
          icon={<CalendarHeart size={24} />} 
          label="Plans" 
          isActive={activeTab === 'plans'} 
          onClick={() => onTabChange('plans')} 
          color={currentUser?.theme_color}
        />
        <div className="relative">
          <NavButton 
            icon={<MessageCircleHeart size={24} />} 
            label="Chat" 
            isActive={activeTab === 'chat'} 
            onClick={() => onTabChange('chat')} 
            color={currentUser?.theme_color}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1 right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
              {unreadCount}
            </span>
          )}
        </div>
        <NavButton 
          icon={<ImageIcon size={24} />} 
          label="Memories" 
          isActive={activeTab === 'memories'} 
          onClick={() => onTabChange('memories')} 
          color={currentUser?.theme_color}
        />
      </nav>
    </div>
  );
};

const NavButton = ({ icon, label, isActive, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center space-y-1 w-16 transition-colors duration-300 ${isActive ? 'text-rose-600' : 'text-slate-400'}`}
    style={{ color: isActive ? color : undefined }}
  >
    {icon}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);