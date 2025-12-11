import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { RequestItem, User } from '../types';
import { Plus, Check, X, Calendar, Clock } from 'lucide-react';

interface RequestsProps {
    currentUser: User;
    onBack: () => void;
}

export const Requests: React.FC<RequestsProps> = ({ currentUser, onBack }) => {
    const [requests, setRequests] = useState<RequestItem[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    
    // Form
    const [type, setType] = useState<'date' | 'gift' | 'attention' | 'chore'>('attention');
    const [details, setDetails] = useState('');
    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        const fetchRequests = async () => {
            const { data } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
            if(data) setRequests(data as RequestItem[]);
        };
        fetchRequests();

        const channel = supabase.channel('requests_page_sync')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, (payload) => {
                 if (payload.eventType === 'INSERT') {
                     setRequests(prev => {
                         if (prev.some(r => r.id === payload.new.id)) return prev;
                         const filtered = prev.filter(r => !r.id.startsWith('temp-'));
                         return [payload.new as RequestItem, ...filtered];
                     });
                 }
                 if (payload.eventType === 'UPDATE') setRequests(prev => prev.map(r => r.id === payload.new.id ? payload.new as RequestItem : r));
             })
             .subscribe();
        return () => { supabase.removeChannel(channel) };
    }, []);

    const createRequest = async () => {
        if(!details) return;

        const tempId = `temp-${Date.now()}`;
        const targetDateISO = targetDate ? new Date(targetDate).toISOString() : undefined;
        
        const optimisticReq: RequestItem = {
            id: tempId,
            from_user: currentUser.display_name,
            type,
            details,
            status: 'pending',
            created_at: new Date().toISOString(),
            target_date: targetDateISO
        };

        // Optimistic Update
        setRequests(prev => [optimisticReq, ...prev]);
        setShowCreate(false);
        setDetails('');
        setTargetDate('');

        const { error } = await supabase.from('requests').insert({
            from_user: currentUser.display_name,
            type,
            details,
            status: 'pending',
            target_date: targetDateISO
        });

        if (error) {
            console.error("Request failed", error);
            setRequests(prev => prev.filter(r => r.id !== tempId));
        }
    };

    const updateStatus = async (id: string, status: 'accepted' | 'completed') => {
        // Optimistic update
        const completedAt = status === 'completed' ? new Date().toISOString() : undefined;
        
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status, completed_at: completedAt } : r));
        
        await supabase.from('requests').update({ 
            status, 
            completed_at: completedAt 
        }).eq('id', id);
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'date': return '🌹';
            case 'gift': return '🎁';
            case 'attention': return '💆‍♂️';
            case 'chore': return '🧹';
            default: return '✨';
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    return (
        <div className="p-6 pt-10 pb-24 min-h-full">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="text-sm font-bold text-slate-400">← Back</button>
                <h2 className="text-2xl font-bold text-slate-800">Love Requests</h2>
                <button onClick={() => setShowCreate(true)} className="p-2 bg-rose-100 text-rose-600 rounded-full"><Plus size={20}/></button>
            </div>

            <div className="space-y-4">
                {requests.length === 0 && <p className="text-center text-slate-400 py-10">No active requests. Ask for something special!</p>}
                
                {requests.map(req => {
                    const isMine = req.from_user === currentUser.display_name;
                    return (
                        <div key={req.id} className={`p-4 rounded-2xl border-2 transition-all ${req.status === 'completed' ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-rose-100 bg-white'} ${req.id.startsWith('temp') ? 'opacity-70' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2 items-center">
                                    <span className="text-2xl bg-slate-100 w-10 h-10 flex items-center justify-center rounded-full">
                                        {getIcon(req.type)}
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">{req.type}</p>
                                        <p className="font-bold text-slate-800">From {req.from_user}</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    req.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 
                                    req.status === 'accepted' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                                }`}>
                                    {req.status}
                                </span>
                            </div>
                            <p className="text-slate-600 mb-4">{req.details}</p>
                            
                            <div className="flex flex-col gap-1 mb-4 text-[10px] text-slate-500">
                                {req.target_date && (
                                    <div className="flex items-center gap-1 text-rose-500 font-medium">
                                        <Calendar size={12} />
                                        <span>Wanted by: {formatDate(req.target_date)}</span>
                                    </div>
                                )}
                                {req.completed_at ? (
                                    <div className="flex items-center gap-1 text-green-600 font-medium">
                                        <Check size={12} />
                                        <span>Completed on: {formatDate(req.completed_at)}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 opacity-70">
                                        <Clock size={12} />
                                        <span>Requested: {formatDate(req.created_at)}</span>
                                    </div>
                                )}
                            </div>
                            
                            {!isMine && req.status !== 'completed' && (
                                <div className="flex gap-2 mt-2">
                                    {req.status === 'pending' && (
                                        <button 
                                            onClick={() => updateStatus(req.id, 'accepted')}
                                            className="flex-1 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold"
                                        >
                                            Accept Request
                                        </button>
                                    )}
                                    {req.status === 'accepted' && (
                                        <button 
                                            onClick={() => updateStatus(req.id, 'completed')}
                                            className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                                        >
                                            <Check size={16} /> Mark Done
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold">Make a Wish</h3>
                             <button onClick={() => setShowCreate(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                            {['attention', 'date', 'gift', 'chore'].map((t) => (
                                <button 
                                    key={t}
                                    onClick={() => setType(t as any)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border-2 ${type === t ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-100 text-slate-400'}`}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <textarea 
                            className="w-full h-24 bg-slate-50 border-none rounded-xl p-4 mb-3 focus:ring-2 focus:ring-rose-200 outline-none text-slate-700 resize-none"
                            placeholder="I would love it if..."
                            value={details}
                            onChange={e => setDetails(e.target.value)}
                        />
                        
                        <div className="mb-4">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">When? (Optional)</label>
                            <input 
                                type="datetime-local" 
                                className="w-full bg-slate-50 rounded-xl p-3 text-sm text-slate-700 outline-none"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={createRequest}
                            className="w-full py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg"
                        >
                            Send Request
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};