import React, { useState, useEffect, useRef } from 'react';
import { User, RequestItem, Memory, ItineraryItem } from '../types';
import { supabase, uploadFile } from '../supabase';
import { Heart, Bell, Image as ImageIcon, CheckCircle, ListTodo, Settings, Camera, LogOut, Palette, X } from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onRequestClick: () => void;
  onProfileUpdate: () => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onRequestClick, onProfileUpdate, onLogout }) => {
  const [daysTogether, setDaysTogether] = useState(0);
  const [moods, setMoods] = useState<{ Lulu: string, Lala: string }>({ Lulu: '😐', Lala: '😐' });
  const [pendingRequests, setPendingRequests] = useState<RequestItem[]>([]);
  const [latestMemory, setLatestMemory] = useState<Memory | null>(null);
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<ItineraryItem | null>(null);
  const [totalSavings, setTotalSavings] = useState(0);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Updated Anniversary Date: 11/03/2024 01:18:18
  const START_DATE = new Date('2024-11-03T01:18:18');

  useEffect(() => {
    // Calculate Days Together
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - START_DATE.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    setDaysTogether(diffDays);

    // Check Daily Challenge
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('lulu_lala_challenge_date');
    if (storedDate === today) {
        setChallengeCompleted(true);
    } else {
        localStorage.removeItem('lulu_lala_challenge_date');
        setChallengeCompleted(false);
    }

    // Load Moods
    const fetchMoods = async () => {
        const { data } = await supabase.from('profiles').select('display_name, current_mood');
        if (data) {
            const newMoods: any = { ...moods };
            data.forEach((p: any) => { newMoods[p.display_name] = p.current_mood || '😐'; });
            setMoods(newMoods);
        }
    };
    fetchMoods();

    // Fetch Latest Memory
    const fetchLatestMemory = async () => {
        // Sort by date AND created_at to ensure the absolute newest upload shows up
        const { data } = await supabase.from('memories')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        if (data) setLatestMemory(data as Memory);
    }
    fetchLatestMemory();

    // Fetch Tasks, Events, & Finances for Summary
    const fetchSummary = async () => {
        const { count } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        setActiveTasksCount(count || 0);

        const todayDate = new Date().toISOString().split('T')[0];
        const { data: events } = await supabase.from('itineraries').select('*').gte('date', todayDate).order('date', { ascending: true }).limit(1);
        if(events && events.length > 0) setNextEvent(events[0] as ItineraryItem);

        const { data: finances } = await supabase.from('finances').select('current_amount').eq('type', 'saving');
        if (finances) {
            const total = finances.reduce((acc, curr) => acc + (curr.current_amount || 0), 0);
            setTotalSavings(total);
        }
    };
    fetchSummary();

    // Subscribe to updates
     const channel = supabase
      .channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async () => {
         // Refresh requests
         const { data } = await supabase.from('requests').select('*').eq('status', 'pending');
         if(data) setPendingRequests(data as RequestItem[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
          if(payload.new) {
             const p = payload.new as any;
             setMoods(prev => ({...prev, [p.display_name]: p.current_mood}));
          }
      })
      // Listen to ANY change in memories to ensure dashboard is always fresh
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories' }, () => {
          fetchLatestMemory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          fetchSummary();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itineraries' }, () => {
          fetchSummary();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, () => {
          fetchSummary();
      })
      .subscribe();
      
      // Initial Request Fetch
      const loadRequests = async () => {
          const { data } = await supabase.from('requests').select('*').eq('status', 'pending');
          if(data) setPendingRequests(data as RequestItem[]);
      };
      loadRequests();

    return () => { supabase.removeChannel(channel) };
  }, []);

  const updateMood = async (emoji: string) => {
    // Optimistic update
    setMoods(prev => ({ ...prev, [currentUser.display_name]: emoji }));
    await supabase.from('profiles').update({ current_mood: emoji }).eq('display_name', currentUser.display_name);
  };

  const handleCompleteChallenge = () => {
      const today = new Date().toDateString();
      localStorage.setItem('lulu_lala_challenge_date', today);
      setChallengeCompleted(true);
      
      // Fun effect
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3'); 
      audio.volume = 0.5;
      audio.play().catch(() => {});
  };
  
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      setUploadingAvatar(true);
      const file = e.target.files[0];
      const url = await uploadFile('chat-media', `avatar_${currentUser.id}_${Date.now()}`, file);
      if (url) {
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
          onProfileUpdate();
      }
      setUploadingAvatar(false);
  };

  const updateTheme = async (color: string) => {
      await supabase.from('profiles').update({ theme_color: color }).eq('id', currentUser.id);
      onProfileUpdate();
  };

  const handleLogout = () => {
      // INSTANT LOGOUT - No confirmation
      localStorage.removeItem('lulu_lala_user_id');
      onLogout();
  };

  const emojis = ['😊', '🥰', '😔', '😤', '😴', '🥳'];
  const themeColors = ['#f43f5e', '#4f46e5', '#8b5cf6', '#10b981', '#f59e0b'];

  // Filter requests to show notifications ONLY for incoming requests (not ones I created)
  const incomingRequests = pendingRequests.filter(r => r.from_user !== currentUser.display_name);
  const hasIncoming = incomingRequests.length > 0;

  return (
    <div className="p-6 space-y-6 pt-10">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-script text-rose-600">Welcome, {currentUser.display_name}</h1>
           <p className="text-slate-500 text-sm">Your Shared Love Space 💞</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative cursor-pointer" onClick={onRequestClick}>
                <Heart className={`text-rose-500 fill-rose-500 transition-all ${hasIncoming ? 'animate-shake drop-shadow-lg' : ''}`} size={30} />
                {hasIncoming && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white animate-bounce">
                        {incomingRequests.length}
                    </span>
                )}
            </div>
            <button onClick={() => setShowSettings(true)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                <Settings size={20} />
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4">
        {/* Days Together */}
        <div className="flex-1 bg-navy-900 text-white p-5 rounded-3xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition"></div>
            <span className="text-4xl font-bold font-sans">{daysTogether}</span>
            <span className="text-xs uppercase tracking-wider opacity-80 mt-1 text-center">Days Together</span>
        </div>
        
        {/* Mood Fusion */}
        <div className="flex-1 bg-rose-200 text-rose-800 p-5 rounded-3xl shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex text-3xl z-10">
                <span>{moods.Lulu}</span>
                <span className="mx-1">+</span>
                <span>{moods.Lala}</span>
            </div>
            <span className="text-xs uppercase tracking-wider opacity-80 mt-2 z-10 text-center">Mood Fusion</span>
            <div className="absolute -bottom-4 -right-4 text-9xl opacity-10">❤️</div>
        </div>
      </div>

      {/* Life At A Glance */}
      <div className="bg-indigo-600 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
          <div className="relative z-10">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-100 text-sm">
                  <ListTodo size={16} /> Life At A Glance
              </h3>
              <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="text-center">
                      <div className="text-2xl font-bold">{activeTasksCount}</div>
                      <div className="text-[9px] opacity-70 uppercase tracking-wide">Pending Tasks</div>
                  </div>
                  
                  <div className="text-center border-l border-indigo-500/50 border-r">
                      <div className="text-2xl font-bold flex items-center justify-center gap-1">
                          <span className="text-sm opacity-70">₦</span>{totalSavings.toLocaleString()}
                      </div>
                      <div className="text-[9px] opacity-70 uppercase tracking-wide flex justify-center items-center gap-1">
                          Savings
                      </div>
                  </div>

                  <div className="text-center">
                      {nextEvent ? (
                          <>
                            <div className="text-xs font-bold truncate">{nextEvent.title}</div>
                            <div className="text-[9px] opacity-70">{new Date(nextEvent.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</div>
                          </>
                      ) : (
                          <div className="text-[9px] opacity-60">No Events</div>
                      )}
                      <div className="text-[9px] opacity-50 uppercase tracking-wide mt-1">Next Event</div>
                  </div>
              </div>
          </div>
      </div>

      {/* Mood Selector */}
      <div className="bg-white p-4 rounded-3xl shadow-sm">
        <p className="text-center text-slate-500 text-sm mb-3">How are you feeling?</p>
        <div className="flex justify-between">
            {emojis.map(e => (
                <button key={e} onClick={() => updateMood(e)} className="text-2xl hover:scale-125 transition transform">
                    {e}
                </button>
            ))}
        </div>
      </div>

      {/* Latest Memory */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-rose-50">
          <div className="flex items-center gap-2 mb-3 text-slate-600">
              <ImageIcon size={18} />
              <h3 className="font-bold text-sm">Latest Memory</h3>
          </div>
          {latestMemory ? (
              <div className="bg-slate-50 rounded-2xl overflow-hidden">
                  <div className="relative bg-black/5 flex justify-center items-center">
                      <img 
                        src={latestMemory.photos[0]} 
                        alt="Latest" 
                        className="max-w-full max-h-96 w-auto object-contain" 
                      />
                  </div>
                  <div className="p-3 bg-white">
                      <p className="text-slate-800 text-sm font-bold truncate">{latestMemory.title || 'Untitled Memory'}</p>
                      <p className="text-slate-400 text-[10px]">{new Date(latestMemory.date).toLocaleDateString()}</p>
                  </div>
              </div>
          ) : (
              <div className="h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                  No memories yet. Upload one!
              </div>
          )}
      </div>

      {/* Daily Challenge */}
      <div className={`transition-colors duration-500 p-5 rounded-3xl shadow-lg text-white ${challengeCompleted ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-rose-400 to-rose-600'}`}>
        <div className="flex items-center gap-2 mb-2">
            <Bell size={18} />
            <h3 className="font-bold">Daily Love Challenge</h3>
        </div>
        <p className="text-sm opacity-90 mb-4">
            {challengeCompleted 
                ? "You did it! Keep the love flowing." 
                : `Send ${currentUser.display_name === 'Lulu' ? 'Lala' : 'Lulu'} a voice note singing a silly song.`
            }
        </p>
        <button 
            onClick={handleCompleteChallenge}
            disabled={challengeCompleted}
            className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                challengeCompleted 
                ? 'bg-white/20 cursor-default' 
                : 'bg-white/20 hover:bg-white/30'
            }`}
        >
            {challengeCompleted ? (
                <><CheckCircle size={14} /> Completed Today</>
            ) : (
                'Mark Complete'
            )}
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
              <div className="bg-white rounded-[40px] p-6 w-full max-w-sm animate-float shadow-2xl relative">
                  <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-500 transition">
                      <X size={20} />
                  </button>
                  
                  <h2 className="text-xl font-bold text-center mb-6 text-slate-800">My Profile</h2>
                  
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center mb-6">
                      <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                          <div className="w-24 h-24 rounded-full bg-rose-100 overflow-hidden border-4 border-white shadow-lg">
                              {currentUser.avatar_url ? (
                                  <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl">
                                      {currentUser.display_name === 'Lulu' ? '🌸' : '🎸'}
                                  </div>
                              )}
                          </div>
                          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                              <Camera className="text-white" size={24} />
                          </div>
                          {uploadingAvatar && (
                              <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                                  <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                          )}
                      </div>
                      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                      <p className="text-xs text-slate-400 mt-2">Tap to change photo</p>
                  </div>

                  {/* Theme Color */}
                  <div className="mb-8">
                      <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                          <Palette size={16} /> Theme Color
                      </h3>
                      <div className="flex justify-between px-2">
                          {themeColors.map(color => (
                              <button 
                                key={color} 
                                onClick={() => updateTheme(color)}
                                className={`w-10 h-10 rounded-full border-2 transition transform hover:scale-110 ${currentUser.theme_color === color ? 'border-slate-800 scale-110' : 'border-white shadow-md'}`}
                                style={{ backgroundColor: color }}
                              />
                          ))}
                      </div>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500 transition"
                  >
                      <LogOut size={18} /> Sign Out
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};