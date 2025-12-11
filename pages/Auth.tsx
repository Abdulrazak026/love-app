import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Copy, Database, AlertTriangle, Loader2, RotateCcw, X, ShieldCheck, Check } from 'lucide-react';

interface AuthProps {
    onLogin: (user: any) => void;
}

// Robust SQL Script with safety checks and policy resets
const SQL_SCRIPT = `-- 0. Safety: ensure extension for gen_random_uuid exists (pgcrypto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END;
$$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name text UNIQUE NOT NULL,
  pin text NOT NULL,
  theme_color text,
  current_mood text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'text',
  harmony_softened boolean DEFAULT false,
  reactions jsonb DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  assigned_to text NOT NULL,
  created_by text NOT NULL,
  status text DEFAULT 'pending',
  priority text DEFAULT 'medium',
  is_shared boolean DEFAULT true,
  due_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Task Comments Table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Requests Table
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user text NOT NULL,
  type text NOT NULL,
  details text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration for new request columns
DO $$
BEGIN
  ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS target_date timestamp with time zone;
  ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END;
$$;

-- 6. Memories Table
CREATE TABLE IF NOT EXISTS public.memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  date date NOT NULL,
  photos text[] NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Itineraries Table
CREATE TABLE IF NOT EXISTS public.itineraries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  date timestamp with time zone NOT NULL,
  time text,
  location text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Finances Table
CREATE TABLE IF NOT EXISTS public.finances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  target_amount numeric DEFAULT 0,
  current_amount numeric DEFAULT 0,
  type text DEFAULT 'saving', -- 'saving' or 'expense'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Life Visions Table
CREATE TABLE IF NOT EXISTS public.life_visions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'Career', 'Living', etc.
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Storage Bucket inserts (safe: only if storage.buckets exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('chat-media', 'chat-media', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public)
    VALUES ('memories', 'memories', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 11. Security Policies - FORCE RESET to ensure DELETE works
DO $$
BEGIN
  -- Enable RLS on all tables
  DECLARE
    tables text[] := ARRAY['profiles', 'messages', 'tasks', 'task_comments', 'requests', 'memories', 'itineraries', 'finances', 'life_visions'];
    t text;
  BEGIN
    FOREACH t IN ARRAY tables
    LOOP
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
        BEGIN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
          -- Drop existing policy to avoid conflicts or stale rules
          EXECUTE format('DROP POLICY IF EXISTS "Public Access" ON public.%I', t);
          -- Create fresh policy allowing ALL operations (SELECT, INSERT, UPDATE, DELETE)
          EXECUTE format('CREATE POLICY "Public Access" ON public.%I FOR ALL USING (true)', t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END IF;
    END LOOP;
  END;
END;
$$;

-- Storage Policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    BEGIN
      DROP POLICY IF EXISTS "Public Access" ON storage.objects;
      CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (true);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;

-- 12. Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    DECLARE
      tables text[] := ARRAY['messages', 'tasks', 'task_comments', 'profiles', 'requests', 'memories', 'itineraries', 'finances', 'life_visions'];
      t text;
    BEGIN
      FOREACH t IN ARRAY tables
      LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
          BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END LOOP;
    END;
  END IF;
END;
$$;`;

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [selectedUser, setSelectedUser] = useState<'Lulu' | 'Lala' | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [checkingProfile, setCheckingProfile] = useState(false);
    const [dbMissing, setDbMissing] = useState(false);
    const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            const savedId = localStorage.getItem('lulu_lala_user_id');
            if (savedId) {
                const { data, error } = await supabase.from('profiles').select('*').eq('id', savedId).single();
                if (error) {
                    // Check for missing tables
                    if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
                        setDbMissing(true);
                        setLoading(false);
                        return;
                    }
                }
                if (data) {
                    onLogin(data);
                    return;
                }
            }
            setLoading(false);
        };
        checkSession();
    }, [onLogin]);

    const handleUserSelect = async (user: 'Lulu' | 'Lala') => {
        setSelectedUser(user);
        setCheckingProfile(true);
        setError('');
        setPin('');
        
        const { data, error } = await supabase.from('profiles').select('*').eq('display_name', user).single();
        
        // PGRST116 means no rows found, which is what we want for a new user
        if (error && error.code !== 'PGRST116') {
             if (error.code === '42P01' || error.message.includes('relation')) {
                 setDbMissing(true);
             } else {
                 console.error("Profile check error:", error);
             }
        }
        
        setIsNewUser(!data); // If no data, isNewUser = true
        setCheckingProfile(false); 
    };

    const handleResetSuccess = () => {
        localStorage.removeItem('lulu_lala_user_id');
        alert(`Success! Profile for ${selectedUser} has been reset. Please create a new PIN.`);
        
        // Reset state so user can login/create profile again immediately
        setSelectedUser(null);
        setPin('');
        setError('');
        setIsNewUser(null);
        setShowResetConfirm(false);
        setLoading(false);
    };

    const performReset = async () => {
        if (!selectedUser) return;
        setLoading(true);
        setError('');

        // 1. Check if user actually exists first to avoid errors
        const { data: existing } = await supabase.from('profiles').select('id').eq('display_name', selectedUser).single();
        
        if (!existing) {
             // Already deleted or never existed
             handleResetSuccess();
             return;
        }

        // 2. Perform Delete
        // SAFETY: This only deletes the row in 'profiles'. 
        // Messages, Tasks, etc. are linked by the text name "Lulu" or "Lala", so they are NOT deleted.
        const { error } = await supabase.from('profiles').delete().eq('display_name', selectedUser);
        
        if (error) {
            console.error("Delete failed:", error);
            setLoading(false);
            setShowResetConfirm(false);
            setError(`Reset failed: ${error.message}. Please try running the SQL script again.`);
        } else {
            handleResetSuccess();
        }
    };

    const handleLogin = async () => {
        if (!selectedUser || pin.length < 4) return;
        setLoading(true);
        setError('');

        if (isNewUser) {
            // Check PIN Uniqueness first
            const { data: pinConflict } = await supabase
                .from('profiles')
                .select('id')
                .eq('pin', pin)
                .single();

            if (pinConflict) {
                setError("This PIN is already used! Choose a unique one.");
                setLoading(false);
                return;
            }

            // Create New Profile
            const { data: newUser, error: createError } = await supabase
                .from('profiles')
                .insert({ 
                    display_name: selectedUser, 
                    pin, 
                    theme_color: selectedUser === 'Lulu' ? '#f43f5e' : '#4f46e5' 
                })
                .select()
                .single();

            if (createError) {
                if (createError.code === '23505') { 
                    // Profile already exists despite our check (race condition)
                    setError("Profile exists! Please login.");
                    setIsNewUser(false);
                } else {
                    setError(createError.message);
                }
            } else if (newUser) {
                localStorage.setItem('lulu_lala_user_id', newUser.id);
                onLogin(newUser);
            }
        } else {
            // Login Existing
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('*')
                .eq('display_name', selectedUser)
                .single();
                
            if (existingUser) {
                if (existingUser.pin === pin) {
                    localStorage.setItem('lulu_lala_user_id', existingUser.id);
                    onLogin(existingUser);
                } else {
                    setError("Werey is this ur profile ?");
                }
            } else {
                // If we thought it was existing user but now can't find it, switch to new user
                setIsNewUser(true);
                setError("Profile not found. Please create PIN.");
            }
        }
        setLoading(false);
    };

    const copySQL = () => {
        navigator.clipboard.writeText(SQL_SCRIPT);
        alert("SQL Setup Script copied to clipboard! Run it in Supabase SQL Editor.");
    };

    if (dbMissing) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-slate-800">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-2xl w-full border border-red-100">
                    <div className="flex items-center gap-3 text-red-500 mb-4">
                        <AlertTriangle size={32} />
                        <h1 className="text-2xl font-bold">Database Setup Required</h1>
                    </div>
                    <p className="mb-4 text-slate-600">
                        The application cannot find the required tables. Please initialize your Supabase database by running the script below.
                    </p>
                    
                    <div className="bg-navy-800 rounded-xl p-4 relative group mb-6">
                         <div className="absolute top-2 right-2 flex gap-2">
                             <span className="text-xs text-slate-400 mt-2 mr-2">SQL Editor</span>
                             <button 
                                onClick={copySQL}
                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                                title="Copy SQL"
                             >
                                <Copy size={16}/>
                             </button>
                         </div>
                         <pre className="text-xs font-mono text-green-400 overflow-x-auto h-64 whitespace-pre-wrap p-2">
                             {SQL_SCRIPT}
                         </pre>
                    </div>

                    <div className="flex justify-end gap-3 flex-wrap">
                         <button 
                            onClick={() => window.open('https://supabase.com/dashboard/project/dhgexntbworzwbdftspq/sql/new', '_blank')}
                            className="px-6 py-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                        >
                            <Database size={18} /> Open SQL Editor
                        </button>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition shadow-lg"
                        >
                            I've Run It, Refresh App
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading && !selectedUser) {
        return (
             <div className="min-h-screen bg-rose-50 flex items-center justify-center">
                 <div className="animate-pulse text-rose-500 font-script text-2xl">Opening Heart...</div>
             </div>
        );
    }

    return (
        <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-10 left-10 w-32 h-32 bg-rose-200 rounded-full blur-3xl opacity-50 animate-pulse-slow"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-50 animate-pulse-slow"></div>

            <div className="z-10 w-full max-w-sm bg-white/80 backdrop-blur-xl p-8 rounded-[40px] shadow-2xl border border-white">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-script font-bold text-rose-600 mb-2">Lulu & Lala 💞</h1>
                    <p className="text-slate-500 text-sm">Your Shared Love Space</p>
                </div>

                {!selectedUser ? (
                    <div className="space-y-4">
                        <p className="text-center text-slate-800 font-medium mb-4">Who are you?</p>
                        <button 
                            onClick={() => handleUserSelect('Lulu')}
                            className="w-full py-4 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-2xl font-bold transition transform hover:scale-105"
                        >
                            I am Lulu 🌸
                        </button>
                        <button 
                            onClick={() => handleUserSelect('Lala')}
                            className="w-full py-4 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 rounded-2xl font-bold transition transform hover:scale-105"
                        >
                            I am Lala 🎸
                        </button>
                    </div>
                ) : (
                    <div className="animate-float">
                        {checkingProfile ? (
                            <div className="py-12 flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin text-rose-500 mb-2" size={32} />
                                <p className="text-slate-400 text-sm font-bold">Checking Profile...</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-center text-slate-800 font-medium mb-4">
                                    {isNewUser ? (
                                        <span className="text-rose-600 font-bold">Create Profile for {selectedUser}</span>
                                    ) : (
                                        <span>Welcome back, {selectedUser}!</span>
                                    )}
                                </p>
                                
                                <div className="mb-6">
                                    <p className="mb-2 text-slate-500 text-sm font-bold text-center">
                                        {isNewUser ? "Create Secret PIN" : "Enter PIN"}
                                    </p>
                                    <input 
                                        type="password" 
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        maxLength={4}
                                        placeholder="****"
                                        className="w-full text-center text-3xl tracking-[1em] py-3 border-b-2 border-slate-200 focus:border-rose-500 bg-transparent outline-none text-slate-700 placeholder-slate-300"
                                    />
                                </div>
                                
                                {error && <p className="text-red-500 text-center text-sm mb-4 font-bold animate-shake">{error}</p>}

                                <button 
                                    onClick={handleLogin}
                                    disabled={loading || pin.length !== 4}
                                    className="w-full py-4 bg-navy-900 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition disabled:opacity-50"
                                >
                                    {loading ? 'Processing...' : (isNewUser ? 'Create Profile' : 'Enter Love Space')}
                                </button>
                                
                                <div className="flex flex-col items-center mt-6 gap-4">
                                    <button 
                                        onClick={() => { setSelectedUser(null); setPin(''); setError(''); setIsNewUser(null); }}
                                        className="text-slate-400 text-sm hover:text-slate-600"
                                    >
                                        ← Go back
                                    </button>
                                    
                                    {!isNewUser && (
                                        <button 
                                            type="button"
                                            onClick={() => setShowResetConfirm(true)}
                                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition flex items-center gap-2 cursor-pointer z-20"
                                        >
                                            <RotateCcw size={14} /> Forgot / Reset PIN
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl animate-float border-2 border-red-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-800">Reset Profile?</h3>
                            <button 
                                onClick={() => setShowResetConfirm(false)}
                                className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="bg-red-50 p-4 rounded-2xl mb-4 border border-red-100">
                             <p className="text-red-600 text-sm font-bold mb-2 flex items-center gap-2">
                                 <AlertTriangle size={18} /> Warning
                             </p>
                             <p className="text-red-800 text-xs leading-relaxed">
                                 This will remove the current PIN protection for <strong>{selectedUser}</strong>. You will need to create a NEW PIN immediately.
                             </p>
                        </div>

                        <div className="mb-6 space-y-2">
                            <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                                <ShieldCheck size={16} /> Messages are SAFE
                            </div>
                            <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                                <ShieldCheck size={16} /> Photos/Memories are SAFE
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={performReset}
                                disabled={loading}
                                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Yes, Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};