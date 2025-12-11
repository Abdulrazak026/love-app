import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadFile } from '../supabase';
import { Memory, User } from '../types';
import { Plus, Calendar, Loader2, Trash2 } from 'lucide-react';

interface MemoriesProps {
    currentUser: User;
}

export const Memories: React.FC<MemoriesProps> = ({ currentUser }) => {
    const [memories, setMemories] = useState<Memory[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchMemories = async () => {
            const { data } = await supabase.from('memories').select('*').order('date', { ascending: false });
            if(data) setMemories(data as Memory[]);
        };
        fetchMemories();

        const channel = supabase.channel('memories_sync')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memories' }, (payload) => {
                 setMemories(prev => {
                     const exists = prev.some(m => m.id === payload.new.id);
                     if (exists) return prev;
                     return [payload.new as Memory, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                 });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memories' }, (payload) => {
                setMemories(prev => prev.filter(m => m.id !== payload.old.id));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel) };
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setUploading(true);

        // Optimistic Update
        const tempId = `temp-${Date.now()}`;
        const tempUrl = URL.createObjectURL(file);
        const optimisticMemory: Memory = {
            id: tempId,
            title: 'Uploading...',
            date: new Date().toISOString().split('T')[0],
            photos: [tempUrl],
            description: '',
            created_at: new Date().toISOString()
        };

        setMemories(prev => [optimisticMemory, ...prev]);

        // Upload
        const url = await uploadFile('memories', `memory_${Date.now()}`, file);
        if(url) {
            // Save to DB
            const { error } = await supabase.from('memories').insert({
                title: `Memory ${new Date().toLocaleDateString()}`,
                date: new Date().toISOString().split('T')[0],
                photos: [url],
                description: ''
            });

            if (error) {
                console.error("Failed to save memory", error);
                setMemories(prev => prev.filter(m => m.id !== tempId));
                alert("Failed to upload memory.");
            } else {
                setMemories(prev => prev.filter(m => m.id !== tempId));
            }
        } else {
            setMemories(prev => prev.filter(m => m.id !== tempId));
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const deleteMemory = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // INSTANT DELETION - No confirmation
        const previousMemories = [...memories];
        setMemories(prev => prev.filter(m => m.id !== id));

        const { error } = await supabase.from('memories').delete().eq('id', id);

        if (error) {
            console.error("Error deleting memory:", error);
            setMemories(previousMemories);
            alert("Could not delete memory.");
        }
    };

    const stopProp = (e: any) => e.stopPropagation();

    return (
        <div className="p-6 pt-10 pb-24 min-h-full">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Memory Lane</h2>
                <div className="relative">
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="p-3 bg-rose-500 text-white rounded-full shadow-lg flex items-center justify-center disabled:opacity-70"
                    >
                        {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {memories.map(memory => (
                    <div key={memory.id} className={`break-inside-avoid mb-4 bg-white p-2 rounded-2xl shadow-sm relative group ${memory.id.startsWith('temp') ? 'opacity-70 animate-pulse' : ''}`}>
                        <div className="relative w-full h-40 mb-2">
                             <img 
                                src={memory.photos[0]} 
                                alt={memory.title} 
                                className="w-full h-full object-cover rounded-xl"
                            />
                            {memory.id.startsWith('temp') && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                    <Loader2 className="text-white animate-spin" />
                                </div>
                            )}
                            {!memory.id.startsWith('temp') && (
                                <button 
                                    onClick={(e) => deleteMemory(memory.id, e)}
                                    onMouseDown={stopProp}
                                    onTouchStart={stopProp}
                                    className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        <h3 className="font-bold text-slate-700 text-sm truncate px-1">{memory.title}</h3>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1 pb-1">
                            <Calendar size={10} />
                            {new Date(memory.date).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};