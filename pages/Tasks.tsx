import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Task, User, TaskComment } from '../types';
import { Plus, Calendar, CheckCircle2, Circle, MessageSquare, X, Send } from 'lucide-react';

interface TasksProps {
    currentUser: User;
}

export const Tasks: React.FC<TasksProps> = ({ currentUser }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filter, setFilter] = useState<'all' | 'mine'>('all');
    const [showCreate, setShowCreate] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [newComment, setNewComment] = useState('');
    
    // Create Form State
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('Both');

    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Initial Task Load & Realtime
    useEffect(() => {
        const fetchTasks = async () => {
            const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
            if (data) setTasks(data as any);
        };
        fetchTasks();

        const channel = supabase.channel('tasks_list_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTasks(prev => {
                        // Avoid duplicates from optimistic updates
                        if (prev.some(t => t.id === payload.new.id)) return prev;
                        // Replace temp task if it matches (hard to match exactly without ID, so we filter temp)
                        const filtered = prev.filter(t => !t.id.startsWith('temp-'));
                        return [payload.new as any, ...filtered];
                    });
                }
                if (payload.eventType === 'UPDATE') setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as any : t));
                if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, []);

    // Load Comments when a task is selected
    useEffect(() => {
        if (!selectedTask) return;

        const fetchComments = async () => {
            const { data } = await supabase
                .from('task_comments')
                .select('*')
                .eq('task_id', selectedTask.id)
                .order('created_at', { ascending: true });
            if (data) setComments(data as any);
        };
        fetchComments();

        const channelName = `comments_sync_${selectedTask.id}`;
        const channel = supabase.channel(channelName)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'task_comments', 
                filter: `task_id=eq.${selectedTask.id}` 
            }, (payload) => {
                const newComment = payload.new as TaskComment;
                setComments(prev => [...prev, newComment]);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [selectedTask]);

    useEffect(() => {
        if (selectedTask) {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [comments, selectedTask]);

    const toggleTask = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation(); 
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        if (selectedTask?.id === task.id) {
            setSelectedTask({ ...task, status: newStatus });
        }
        await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    };

    const createTask = async () => {
        if (!newTaskTitle) return;
        
        const tempId = `temp-${Date.now()}`;
        const optimisticTask: Task = {
            id: tempId,
            title: newTaskTitle,
            assigned_to: newTaskAssignee as any,
            created_by: currentUser.display_name,
            is_shared: true,
            status: 'pending',
            priority: 'medium',
            created_at: new Date().toISOString()
        };

        // Optimistic Update
        setTasks(prev => [optimisticTask, ...prev]);
        setNewTaskTitle('');
        setShowCreate(false);

        const { error } = await supabase.from('tasks').insert({
            title: optimisticTask.title,
            assigned_to: optimisticTask.assigned_to,
            created_by: optimisticTask.created_by,
            is_shared: true,
            status: 'pending',
            priority: 'medium'
        });
        
        if (error) {
            console.error("Task creation failed", error);
            setTasks(prev => prev.filter(t => t.id !== tempId));
        }
    };

    const sendComment = async () => {
        if (!newComment.trim() || !selectedTask) return;
        
        const { error } = await supabase.from('task_comments').insert({
            task_id: selectedTask.id,
            user_id: currentUser.display_name,
            content: newComment
        });

        if (!error) {
            setNewComment('');
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (filter === 'mine') return t.assigned_to === currentUser.display_name || t.assigned_to === 'Both';
        return true;
    });

    return (
        <div className="p-6 pt-10 pb-24 min-h-full relative">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Our Tasks</h2>
            
            {/* Filter */}
            <div className="flex gap-2 mb-6">
                <button 
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === 'all' ? 'bg-navy-800 text-white' : 'bg-white text-slate-500'}`}
                >
                    All Tasks
                </button>
                <button 
                    onClick={() => setFilter('mine')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === 'mine' ? 'bg-navy-800 text-white' : 'bg-white text-slate-500'}`}
                >
                    My Tasks
                </button>
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredTasks.map(task => (
                    <div 
                        key={task.id} 
                        onClick={() => setSelectedTask(task)}
                        className={`bg-white p-4 rounded-2xl shadow-sm flex items-start gap-3 active:scale-95 transition duration-150 cursor-pointer ${task.id.startsWith('temp') ? 'opacity-70' : ''}`}
                    >
                        <button onClick={(e) => toggleTask(task, e)} className="mt-1 text-rose-500">
                            {task.status === 'completed' ? <CheckCircle2 /> : <Circle />}
                        </button>
                        <div className="flex-1">
                            <h3 className={`font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                {task.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] px-2 py-1 rounded-md ${task.assigned_to === 'Both' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {task.assigned_to}
                                </span>
                                {task.due_date && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* FAB */}
            <button 
                onClick={() => setShowCreate(true)}
                className="fixed bottom-24 right-6 w-14 h-14 bg-navy-900 text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-105 transition"
            >
                <Plus size={24} />
            </button>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-float">
                        <h3 className="text-lg font-bold mb-4">New Task</h3>
                        <input 
                            className="w-full border-b-2 border-slate-100 py-2 focus:border-rose-500 outline-none mb-4"
                            placeholder="What needs to be done?"
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                        />
                        <div className="flex gap-2 mb-6">
                            {['Lulu', 'Lala', 'Both'].map(who => (
                                <button 
                                    key={who}
                                    onClick={() => setNewTaskAssignee(who)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border ${newTaskAssignee === who ? 'bg-rose-500 text-white border-rose-500' : 'text-slate-400 border-slate-200'}`}
                                >
                                    {who}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCreate(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={createTask} className="flex-1 py-3 bg-navy-900 text-white rounded-xl font-bold shadow-lg">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Details Overlay */}
            {selectedTask && (
                <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-float">
                     <div className="p-4 border-b flex justify-between items-center bg-rose-50">
                        <button onClick={() => setSelectedTask(null)} className="p-2 bg-white rounded-full shadow-sm text-slate-500">
                            <X size={20} />
                        </button>
                        <span className="font-bold text-slate-700">Task Details</span>
                        <div className="w-10"></div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 pb-24">
                        <div className="mb-6">
                             <div className="flex items-start gap-3 mb-2">
                                <button onClick={(e) => toggleTask(selectedTask, e)} className="mt-1 text-rose-500">
                                    {selectedTask.status === 'completed' ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                                </button>
                                <h2 className={`text-2xl font-bold ${selectedTask.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                    {selectedTask.title}
                                </h2>
                             </div>
                             <div className="flex gap-2 ml-10">
                                <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-bold">
                                    For: {selectedTask.assigned_to}
                                </span>
                             </div>
                        </div>

                        {/* Comments Section */}
                        <div className="bg-slate-50 rounded-2xl p-4 min-h-[300px]">
                            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2">
                                <MessageSquare size={16} /> Comments
                            </h3>
                            <div className="space-y-4 mb-4">
                                {comments.length === 0 ? (
                                    <p className="text-center text-slate-300 text-sm italic py-4">No comments yet. Discuss this task!</p>
                                ) : (
                                    comments.map(c => (
                                        <div key={c.id} className={`flex ${c.user_id === currentUser.display_name ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${
                                                c.user_id === currentUser.display_name 
                                                ? 'bg-rose-500 text-white rounded-br-none' 
                                                : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                                            }`}>
                                                <p>{c.content}</p>
                                                <span className="text-[10px] opacity-70 block text-right mt-1">
                                                    {new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={commentsEndRef} />
                            </div>
                        </div>
                     </div>

                     <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2 items-center">
                        <input 
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                            placeholder="Add a note..."
                            className="flex-1 bg-slate-100 rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-rose-200"
                            onKeyDown={e => e.key === 'Enter' && sendComment()}
                        />
                        <button onClick={sendComment} className="p-3 bg-navy-900 text-white rounded-full shadow-lg">
                            <Send size={18} />
                        </button>
                     </div>
                </div>
            )}
        </div>
    );
};