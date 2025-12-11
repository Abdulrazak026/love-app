import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Task, User, TaskComment, ItineraryItem, FinanceItem, LifeVisionItem } from '../types';
import { Plus, CheckCircle2, Circle, MessageSquare, X, Send, MapPin, TrendingUp, PiggyBank, Trash2, Briefcase, Home as HomeIcon, Heart, MountainSnow, Check } from 'lucide-react';

interface PlansProps {
    currentUser: User;
}

export const Plans: React.FC<PlansProps> = ({ currentUser }) => {
    const [activeSection, setActiveSection] = useState<'tasks' | 'itinerary' | 'finance' | 'vision'>('tasks');
    
    return (
        <div className="p-6 pt-10 pb-24 min-h-full relative">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Our Plans</h2>
            
            {/* Top Navigation Segments */}
            <div className="flex overflow-x-auto no-scrollbar bg-slate-100 p-1 rounded-2xl mb-6 gap-1">
                {['Tasks', 'Itinerary', 'Finance', 'Vision'].map((tab) => {
                    const id = tab.toLowerCase() as any;
                    return (
                        <button 
                            key={id}
                            onClick={() => setActiveSection(id)}
                            className={`flex-1 min-w-[80px] py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${activeSection === id ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeSection === 'tasks' && <TasksSection currentUser={currentUser} />}
            {activeSection === 'itinerary' && <ItinerarySection />}
            {activeSection === 'finance' && <FinanceSection />}
            {activeSection === 'vision' && <VisionSection />}
        </div>
    );
};

// --- TASKS SECTION ---
const TasksSection: React.FC<{currentUser: User}> = ({ currentUser }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('Both');
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const commentsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchTasks = async () => {
            const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
            if (data) setTasks(data as any);
        };
        fetchTasks();
        const sub = supabase.channel('tasks_sub').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
            if (payload.eventType === 'INSERT') {
                setTasks(prev => {
                    if (prev.some(t => t.id === payload.new.id)) return prev;
                    return [payload.new as any, ...prev];
                });
            }
            if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as any : t));
            if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }).subscribe();
        return () => { supabase.removeChannel(sub) };
    }, []);

    useEffect(() => {
        if (!selectedTask) return;
        const fetchComments = async () => {
             const { data } = await supabase.from('task_comments').select('*').eq('task_id', selectedTask.id).order('created_at', {ascending: true});
             if(data) setComments(data as any);
        };
        fetchComments();
        const sub = supabase.channel(`comments_${selectedTask.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `task_id=eq.${selectedTask.id}`}, payload => {
            setComments(prev => [...prev, payload.new as any]);
        }).subscribe();
        return () => { supabase.removeChannel(sub) };
    }, [selectedTask]);

    const toggleTask = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        // INSTANT UI UPDATE
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        if (selectedTask?.id === task.id) setSelectedTask({ ...task, status: newStatus });
        
        await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    };

    const createTask = async () => {
        if (!newTaskTitle) return;
        setShowCreate(false);
        const tempId = `temp-${Date.now()}`;
        const newTaskObj = {
            id: tempId,
            title: newTaskTitle,
            assigned_to: newTaskAssignee,
            created_by: currentUser.display_name,
            status: 'pending',
            priority: 'medium',
            is_shared: true,
            created_at: new Date().toISOString()
        };
        // INSTANT UI UPDATE
        setTasks(prev => [newTaskObj as any, ...prev]);
        setNewTaskTitle('');

        const { data, error } = await supabase.from('tasks').insert({
            title: newTaskTitle,
            assigned_to: newTaskAssignee,
            created_by: currentUser.display_name,
            status: 'pending',
            priority: 'medium',
            is_shared: true
        }).select().single();

        if (error) {
            setTasks(prev => prev.filter(t => t.id !== tempId));
        } else if(data) {
            setTasks(prev => prev.map(t => t.id === tempId ? data as any : t));
        }
    };

    const sendComment = async () => {
        if(!newComment.trim() || !selectedTask) return;
        const comment = newComment;
        setNewComment('');
        await supabase.from('task_comments').insert({
            task_id: selectedTask.id,
            user_id: currentUser.display_name,
            content: comment
        });
    };
    
    const deleteTask = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation();
        // INSTANT UI - NO CONFIRMATION
        setTasks(prev => prev.filter(t => t.id !== task.id));
        if (selectedTask?.id === task.id) setSelectedTask(null);
        await supabase.from('tasks').delete().eq('id', task.id);
    };

    const stopProp = (e: any) => e.stopPropagation();

    return (
        <div>
            <div className="space-y-3">
                {tasks.length === 0 && <p className="text-center text-slate-400 py-10">No plans yet. Add one!</p>}
                {tasks.map(task => (
                     <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-2xl shadow-sm flex items-start gap-3 active:scale-95 transition cursor-pointer relative group">
                        <button onClick={(e) => toggleTask(task, e)} className="mt-1 text-rose-500 shrink-0">
                            {task.status === 'completed' ? <CheckCircle2 /> : <Circle />}
                        </button>
                        <div className="flex-1 pr-8">
                            <h3 className={`font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title}</h3>
                            <div className="flex gap-2 mt-2">
                                <span className={`text-[10px] px-2 py-1 rounded-md ${task.assigned_to === 'Both' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {task.assigned_to}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => deleteTask(task, e)}
                            onMouseDown={stopProp}
                            onTouchStart={stopProp}
                            className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition z-20 hover:bg-red-50 rounded-full"
                        >
                            <Trash2 size={18} />
                        </button>
                     </div>
                ))}
            </div>
            
            <button onClick={() => setShowCreate(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-navy-900 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-105 transition"><Plus size={24} /></button>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <h3 className="text-lg font-bold mb-4">New Plan</h3>
                        <input className="w-full border-b-2 border-slate-100 py-2 focus:border-rose-500 outline-none mb-4" placeholder="What needs doing?" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                        <div className="flex gap-2 mb-6">
                            {['Lulu', 'Lala', 'Both'].map(who => (
                                <button key={who} onClick={() => setNewTaskAssignee(who as any)} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newTaskAssignee === who ? 'bg-rose-500 text-white border-rose-500' : 'text-slate-400 border-slate-200'}`}>{who}</button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCreate(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={createTask} className="flex-1 py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Details */}
            {selectedTask && (
                <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-float">
                     <div className="p-4 border-b flex justify-between items-center bg-rose-50">
                        <button onClick={() => setSelectedTask(null)} className="p-2 bg-white rounded-full shadow-sm text-slate-500"><X size={20} /></button>
                        <span className="font-bold text-slate-700">Plan Details</span>
                        <div className="w-10"></div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 pb-24">
                        <div className="mb-6">
                             <div className="flex items-start gap-3 mb-2">
                                <button onClick={(e) => toggleTask(selectedTask, e)} className="mt-1 text-rose-500">
                                    {selectedTask.status === 'completed' ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                                </button>
                                <h2 className={`text-2xl font-bold ${selectedTask.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{selectedTask.title}</h2>
                             </div>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 min-h-[300px]">
                            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2"><MessageSquare size={16} /> Comments</h3>
                            <div className="space-y-4 mb-4">
                                {comments.map(c => (
                                    <div key={c.id} className={`flex ${c.user_id === currentUser.display_name ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-xl text-sm ${c.user_id === currentUser.display_name ? 'bg-rose-500 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                                            <p>{c.content}</p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={commentsEndRef} />
                            </div>
                        </div>
                     </div>
                     <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2 items-center">
                        <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a note..." className="flex-1 bg-slate-100 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-rose-200" onKeyDown={e => e.key === 'Enter' && sendComment()} />
                        <button onClick={sendComment} className="p-3 bg-navy-900 text-white rounded-full shadow-lg"><Send size={18} /></button>
                     </div>
                </div>
            )}
        </div>
    );
};

// --- ITINERARY SECTION ---
const ItinerarySection: React.FC = () => {
    const [items, setItems] = useState<ItineraryItem[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', date: '', location: '', notes: '' });

    useEffect(() => {
        const fetchItinerary = async () => {
            const { data } = await supabase.from('itineraries').select('*').order('date', { ascending: true });
            if (data) setItems(data as any);
        };
        fetchItinerary();
        const sub = supabase.channel('itin_sub').on('postgres_changes', { event: '*', schema: 'public', table: 'itineraries' }, payload => {
            if (payload.eventType === 'INSERT') setItems(prev => [...prev, payload.new as any].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            if (payload.eventType === 'DELETE') setItems(prev => prev.filter(i => i.id !== payload.old.id));
        }).subscribe();
        return () => { supabase.removeChannel(sub) };
    }, []);

    const addItem = async () => {
        if(!newItem.title || !newItem.date) return;
        setShowAdd(false);
        const tempId = `temp-${Date.now()}`;
        // INSTANT UI
        setItems(prev => [...prev, { ...newItem, id: tempId, created_at: new Date().toISOString() } as any].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setNewItem({ title: '', date: '', location: '', notes: '' });
        
        await supabase.from('itineraries').insert({ ...newItem });
    };

    const deleteItem = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // INSTANT UI - NO CONFIRMATION
        setItems(prev => prev.filter(i => i.id !== id));
        await supabase.from('itineraries').delete().eq('id', id);
    };
    
    const stopProp = (e: any) => e.stopPropagation();

    return (
        <div>
            <div className="relative border-l-2 border-rose-200 ml-4 space-y-8 pb-10">
                {items.length === 0 && <p className="ml-6 text-slate-400">No upcoming trips or dates.</p>}
                {items.map(item => (
                    <div key={item.id} className="relative ml-6 group">
                        <div className="absolute -left-[31px] bg-rose-500 h-4 w-4 rounded-full border-4 border-white shadow-sm"></div>
                        <div className="bg-white p-4 rounded-2xl shadow-sm relative pr-10">
                            <button 
                                onClick={(e) => deleteItem(item.id, e)}
                                onMouseDown={stopProp}
                                onTouchStart={stopProp}
                                className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 transition hover:bg-red-50 rounded-full"
                            >
                                <Trash2 size={14} />
                            </button>
                            <span className="text-xs font-bold text-rose-500 uppercase tracking-wide">{new Date(item.date).toLocaleDateString()}</span>
                            <h3 className="font-bold text-slate-800 text-lg">{item.title}</h3>
                            {item.location && <div className="flex items-center gap-1 text-slate-500 text-sm mt-1"><MapPin size={14} /> {item.location}</div>}
                            {item.notes && <p className="text-slate-600 text-sm mt-2 bg-slate-50 p-2 rounded-lg italic">"{item.notes}"</p>}
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={() => setShowAdd(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-navy-900 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-105 transition"><Plus size={24} /></button>
            
            {showAdd && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <h3 className="text-lg font-bold mb-4">Add Event</h3>
                        <input className="w-full border-b border-slate-100 py-2 mb-3 outline-none" placeholder="Event Title" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        <input type="date" className="w-full border-b border-slate-100 py-2 mb-3 outline-none text-slate-600" value={newItem.date} onChange={e => setNewItem({...newItem, date: e.target.value})} />
                        <input className="w-full border-b border-slate-100 py-2 mb-3 outline-none" placeholder="Location (Optional)" value={newItem.location} onChange={e => setNewItem({...newItem, location: e.target.value})} />
                        <textarea className="w-full bg-slate-50 p-3 rounded-lg mb-4 outline-none" placeholder="Notes..." value={newItem.notes} onChange={e => setNewItem({...newItem, notes: e.target.value})} />
                        <div className="flex gap-3">
                            <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={addItem} className="flex-1 py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- FINANCE SECTION ---
const FinanceSection: React.FC = () => {
    const [items, setItems] = useState<FinanceItem[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newItem, setNewItem] = useState({ title: '', target: '', current: '', type: 'saving' });

    useEffect(() => {
        const fetchFinances = async () => {
            const { data } = await supabase.from('finances').select('*');
            if(data) setItems(data as any);
        };
        fetchFinances();
         const sub = supabase.channel('fin_sub').on('postgres_changes', { event: '*', schema: 'public', table: 'finances' }, payload => {
            if (payload.eventType === 'INSERT') {
                setItems(prev => {
                     if (prev.some(i => i.id === payload.new.id)) return prev;
                     return [...prev, payload.new as any];
                });
            }
            if (payload.eventType === 'DELETE') setItems(prev => prev.filter(i => i.id !== payload.old.id));
        }).subscribe();
        return () => { supabase.removeChannel(sub) };
    }, []);

    const addItem = async () => {
        if(!newItem.title) return;
        setShowAdd(false);
        const tempId = `temp-${Date.now()}`;
        // INSTANT UI
        setItems(prev => [...prev, {
            id: tempId,
            title: newItem.title,
            target_amount: parseFloat(newItem.target) || 0,
            current_amount: parseFloat(newItem.current) || 0,
            type: newItem.type as any,
            created_at: new Date().toISOString()
        }]);
        setNewItem({ title: '', target: '', current: '', type: 'saving' });

        const { data, error } = await supabase.from('finances').insert({ 
            title: newItem.title, 
            target_amount: parseFloat(newItem.target) || 0,
            current_amount: parseFloat(newItem.current) || 0,
            type: newItem.type
        }).select().single();

        if (error) {
            setItems(prev => prev.filter(i => i.id !== tempId));
        } else if (data) {
            setItems(prev => prev.map(i => i.id === tempId ? data as any : i));
        }
    };

    const deleteItem = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // INSTANT UI - NO CONFIRMATION
        setItems(prev => prev.filter(i => i.id !== id));
        await supabase.from('finances').delete().eq('id', id);
    };

    const stopProp = (e: any) => e.stopPropagation();

    return (
        <div className="space-y-4">
             {items.length === 0 && <p className="text-center text-slate-400 py-10">No financial goals set.</p>}
             {items.map(item => {
                 const percent = item.target_amount > 0 ? Math.min(100, (item.current_amount / item.target_amount) * 100) : 0;
                 return (
                    <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm relative group">
                        <button 
                            onClick={(e) => deleteItem(item.id, e)}
                            onMouseDown={stopProp}
                            onTouchStart={stopProp}
                            className="absolute top-3 right-3 p-2 bg-slate-50 text-slate-300 hover:text-red-500 rounded-full transition z-10"
                        >
                            <Trash2 size={16} />
                        </button>
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`p-2 rounded-full ${item.type === 'saving' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {item.type === 'saving' ? <PiggyBank size={18} /> : <TrendingUp size={18} />}
                                </div>
                                <h3 className="font-bold text-slate-800">{item.title}</h3>
                            </div>
                            <span className="font-mono font-bold text-slate-600">₦{item.current_amount.toLocaleString()}</span>
                        </div>
                        {item.type === 'saving' && item.target_amount > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>Progress</span>
                                    <span>Target: ₦{item.target_amount.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>
                 );
             })}

             <button onClick={() => setShowAdd(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-navy-900 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-105 transition"><Plus size={24} /></button>

             {showAdd && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <h3 className="text-lg font-bold mb-4">Add Goal</h3>
                        <div className="flex gap-2 mb-4">
                             <button onClick={() => setNewItem({...newItem, type: 'saving'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newItem.type === 'saving' ? 'bg-green-500 text-white border-green-500' : 'text-slate-400'}`}>Saving</button>
                             <button onClick={() => setNewItem({...newItem, type: 'expense'})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newItem.type === 'expense' ? 'bg-red-500 text-white border-red-500' : 'text-slate-400'}`}>Expense</button>
                        </div>
                        <input className="w-full border-b border-slate-100 py-2 mb-3 outline-none" placeholder="Title (e.g. Vacation Fund)" value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} />
                        <div className="flex gap-2">
                            <input type="number" className="flex-1 border-b border-slate-100 py-2 mb-3 outline-none" placeholder="Current ₦" value={newItem.current} onChange={e => setNewItem({...newItem, current: e.target.value})} />
                            {newItem.type === 'saving' && <input type="number" className="flex-1 border-b border-slate-100 py-2 mb-3 outline-none" placeholder="Target ₦" value={newItem.target} onChange={e => setNewItem({...newItem, target: e.target.value})} />}
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={addItem} className="flex-1 py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- VISION SECTION ---
const VisionSection: React.FC = () => {
    const [visions, setVisions] = useState<LifeVisionItem[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newVision, setNewVision] = useState({ content: '', category: 'Career' as const });

    useEffect(() => {
        const fetchVisions = async () => {
            const { data } = await supabase.from('life_visions').select('*').order('created_at', { ascending: false });
            if(data) setVisions(data as any);
        };
        fetchVisions();
         const sub = supabase.channel('vision_sub').on('postgres_changes', { event: '*', schema: 'public', table: 'life_visions' }, payload => {
            if (payload.eventType === 'INSERT') setVisions(prev => {
                if(prev.some(v => v.id === payload.new.id)) return prev;
                return [payload.new as any, ...prev];
            });
            if (payload.eventType === 'UPDATE') setVisions(prev => prev.map(v => v.id === payload.new.id ? payload.new as any : v));
            if (payload.eventType === 'DELETE') setVisions(prev => prev.filter(i => i.id !== payload.old.id));
        }).subscribe();
        return () => { supabase.removeChannel(sub) };
    }, []);

    const addVision = async () => {
        if(!newVision.content) return;
        setShowAdd(false);
        const tempId = `temp-${Date.now()}`;
        // INSTANT UI
        setVisions(prev => [{ id: tempId, category: newVision.category, content: newVision.content, created_at: new Date().toISOString() }, ...prev]);
        setNewVision({ ...newVision, content: '' });
        
        const { data, error } = await supabase.from('life_visions').insert({ category: newVision.category, content: newVision.content }).select().single();
        if(error) {
            setVisions(prev => prev.filter(v => v.id !== tempId));
        } else if (data) {
            setVisions(prev => prev.map(v => v.id === tempId ? data as any : v));
        }
    };
    
    const deleteVision = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // INSTANT UI - NO CONFIRMATION
        setVisions(prev => prev.filter(v => v.id !== id));
        await supabase.from('life_visions').delete().eq('id', id);
    };

    const toggleDone = async (vision: LifeVisionItem) => {
        // Toggle "Done" status visually using content hack since we can't change schema
        const isDone = vision.content.startsWith('✅ [DONE] ');
        const newContent = isDone ? vision.content.replace('✅ [DONE] ', '') : `✅ [DONE] ${vision.content}`;
        
        // INSTANT UI
        setVisions(prev => prev.map(v => v.id === vision.id ? { ...v, content: newContent } : v));
        
        await supabase.from('life_visions').update({ content: newContent }).eq('id', vision.id);
        
        if (!isDone) {
            // Confetti sound
             const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1114/1114-preview.mp3'); 
             audio.volume = 0.5;
             audio.play().catch(() => {});
        }
    };

    const stopProp = (e: any) => e.stopPropagation();

    const categories = [
        { id: 'Career', icon: <Briefcase size={16}/>, color: 'bg-blue-100 text-blue-600' },
        { id: 'Living', icon: <HomeIcon size={16}/>, color: 'bg-orange-100 text-orange-600' },
        { id: 'Health', icon: <Heart size={16}/>, color: 'bg-red-100 text-red-600' },
        { id: 'Dreams', icon: <MountainSnow size={16}/>, color: 'bg-purple-100 text-purple-600' },
    ];

    return (
        <div className="space-y-4 pb-20">
            {categories.map(cat => {
                const catVisions = visions.filter(v => v.category === cat.id);
                return (
                    <div key={cat.id} className="bg-white p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-50 pb-2">
                             <div className={`p-2 rounded-lg ${cat.color}`}>{cat.icon}</div>
                             <h3 className="font-bold text-slate-800">{cat.id}</h3>
                        </div>
                        {catVisions.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No plans yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {catVisions.map(v => {
                                    const isDone = v.content.startsWith('✅ [DONE] ');
                                    const displayContent = isDone ? v.content.replace('✅ [DONE] ', '') : v.content;
                                    return (
                                        <li key={v.id} className="flex justify-between items-start group border-b border-slate-50 last:border-0 pb-2 last:pb-0">
                                            <p className={`text-base font-bold transition-all ${isDone ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                {displayContent}
                                            </p>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button 
                                                    onClick={() => toggleDone(v)} 
                                                    className={`p-1.5 rounded-full transition ${isDone ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-300 hover:bg-green-50 hover:text-green-500'}`}
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e) => deleteVision(v.id, e)}
                                                    onMouseDown={stopProp}
                                                    onTouchStart={stopProp}
                                                    className="p-1.5 bg-slate-50 text-slate-300 hover:text-red-500 rounded-full transition"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )
            })}
             <button onClick={() => setShowAdd(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-navy-900 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-105 transition"><Plus size={24} /></button>

             {showAdd && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <h3 className="text-lg font-bold mb-4">Add Life Vision</h3>
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                             {categories.map(c => (
                                 <button key={c.id} onClick={() => setNewVision({...newVision, category: c.id as any})} className={`px-3 py-2 rounded-lg text-xs font-bold border whitespace-nowrap ${newVision.category === c.id ? 'bg-rose-500 text-white border-rose-500' : 'text-slate-400'}`}>{c.id}</button>
                             ))}
                        </div>
                        <textarea className="w-full bg-slate-50 p-3 rounded-lg mb-4 outline-none h-32 font-bold text-slate-700" placeholder="What do we envision?" value={newVision.content} onChange={e => setNewVision({...newVision, content: e.target.value})} />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={addVision} className="flex-1 py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};