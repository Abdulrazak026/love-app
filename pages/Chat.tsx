import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Image as ImageIcon, Wand2, Check, Clock, Trash2, HeartHandshake } from 'lucide-react';
import { supabase, uploadFile } from '../supabase';
import { Message, User } from '../types';
import { softenMessage } from '../services/geminiService';

interface ChatProps {
  currentUser: User;
}

export const Chat: React.FC<ChatProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [harmonyMode, setHarmonyMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, audioBlob]);

  // Load Profiles for Avatars
  useEffect(() => {
      const fetchProfiles = async () => {
          const { data } = await supabase.from('profiles').select('display_name, avatar_url');
          if (data) {
              const map: Record<string, string> = {};
              data.forEach((p: any) => {
                  if (p.avatar_url) map[p.display_name] = p.avatar_url;
              });
              setAvatars(map);
          }
      };
      fetchProfiles();
  }, []);

  // Load Initial Messages & Subscribe
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) {
          setMessages(data as Message[]);
          setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Subscribe
    const channel = supabase
      .channel('chat_room_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            setMessages((prev) => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                const cleanPrev = prev.filter(m => 
                    !(m.status === 'sending' && m.content === newMessage.content && m.sender === newMessage.sender)
                );
                return [...cleanPrev, newMessage];
            });

            if (newMessage.sender !== currentUser.display_name) {
               const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
               audio.volume = 0.5;
               audio.play().catch(() => {});
            }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.display_name]);

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Please enable microphone access.");
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !audioBlob) || isSending) return;
    
    const textToSend = inputText;
    const blobToSend = audioBlob;
    
    setInputText('');
    setAudioBlob(null);
    setIsSending(true);

    let content = textToSend;
    let type: 'text' | 'audio' | 'image' = 'text';
    let isSoftened = false;

    // Handle Harmony Mode
    if (harmonyMode && textToSend.trim()) {
      const softened = await softenMessage(textToSend);
      if (softened !== textToSend) {
        content = softened;
        isSoftened = true;
      }
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
        id: tempId,
        sender: currentUser.display_name,
        content: blobToSend ? 'Audio Message' : content,
        type: blobToSend ? 'audio' : 'text',
        created_at: new Date().toISOString(),
        status: 'sending',
        harmony_softened: isSoftened
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(scrollToBottom, 50);

    if (blobToSend) {
      const fileName = `voice_${Date.now()}.webm`;
      const url = await uploadFile('chat-media', fileName, blobToSend);
      if (url) {
        content = url;
        type = 'audio';
      }
    }

    const { error } = await supabase.from('messages').insert({
      sender: currentUser.display_name,
      content,
      type,
      harmony_softened: isSoftened
    });

    if (error) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
    
    setIsSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = await uploadFile('chat-media', `img_${Date.now()}`, file);
      if (url) {
        await supabase.from('messages').insert({
          sender: currentUser.display_name,
          content: url,
          type: 'image'
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white relative">
      {/* Harmony Banner */}
      {harmonyMode && (
          <div className="bg-purple-600 text-white text-xs font-bold py-1 px-4 text-center animate-slide-down flex justify-center items-center gap-2 z-50">
              <HeartHandshake size={14} /> Resolve Conflict Mode Active
          </div>
      )}

      {/* Header */}
      <div className="p-4 border-b bg-white/95 backdrop-blur flex justify-between items-center sticky top-0 z-40 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
            <div className="relative">
                <div className="w-10 h-10 rounded-full bg-rose-100 overflow-hidden border-2 border-rose-200">
                     {avatars[currentUser.display_name === 'Lulu' ? 'Lala' : 'Lulu'] ? (
                         <img src={avatars[currentUser.display_name === 'Lulu' ? 'Lala' : 'Lulu']} className="w-full h-full object-cover" />
                     ) : (
                         <div className="w-full h-full flex items-center justify-center text-sm">
                             {currentUser.display_name === 'Lulu' ? '🎸' : '🌸'}
                         </div>
                     )}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 leading-none">
                {currentUser.display_name === 'Lulu' ? 'Lala' : 'Lulu'}
                </h2>
                <span className="text-xs text-slate-400">Online</span>
            </div>
        </div>
        
        <button 
            onClick={() => setHarmonyMode(!harmonyMode)}
            className={`p-2 rounded-full transition-all flex items-center gap-2 ${harmonyMode ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}
        >
            <Wand2 size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg) => {
          const isMe = msg.sender === currentUser.display_name;
          const userAvatar = avatars[msg.sender];
          
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 mb-1">
                      {userAvatar ? (
                          <img src={userAvatar} alt={msg.sender} className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px]">{msg.sender[0]}</div>
                      )}
                  </div>
              )}
              
              <div 
                className={`max-w-[70%] rounded-2xl p-3 shadow-sm relative ${
                  isMe 
                    ? 'bg-rose-500 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                }`}
              >
                {msg.type === 'text' && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                {msg.type === 'image' && (
                  <img src={msg.content} alt="shared" className="rounded-lg w-full h-auto max-h-60 object-cover" />
                )}
                {msg.type === 'audio' && (
                  <audio controls src={msg.content} className="w-48 h-10" />
                )}
                
                <div className="flex justify-end items-center gap-1 mt-1 opacity-70">
                  {msg.harmony_softened && <Wand2 size={10} />}
                  <span className="text-[10px]">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                      <span className="ml-1">
                          {msg.status === 'sending' ? <Clock size={10} className="animate-pulse" /> : <Check size={10} />}
                      </span>
                  )}
                </div>
              </div>

               {isMe && (
                  <div className="w-6 h-6 rounded-full bg-rose-200 overflow-hidden flex-shrink-0 mb-1 border border-white shadow-sm">
                      {avatars[currentUser.display_name] ? (
                          <img src={avatars[currentUser.display_name]} alt="Me" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px]">Me</div>
                      )}
                  </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-100 p-3 pb-safe-area-bottom w-full shrink-0">
        {audioBlob ? (
          <div className="flex items-center justify-between bg-rose-50 p-3 rounded-xl">
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
               <span className="text-sm text-slate-700">Audio Recorded</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setAudioBlob(null)} className="p-2 text-slate-500"><Trash2 size={20}/></button>
                <button onClick={handleSendMessage} className="p-2 bg-rose-500 text-white rounded-full"><Send size={18}/></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
             <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-rose-500 transition">
                <ImageIcon size={24} />
             </button>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

             <div className="flex-1 relative">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={harmonyMode ? "Type..." : "Message..."}
                    className="w-full bg-slate-100 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200 text-base"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
             </div>

             {inputText ? (
                 <button onClick={handleSendMessage} className="p-3 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition">
                    <Send size={20} />
                 </button>
             ) : (
                 <button 
                    onMouseDown={startRecording} 
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`p-3 rounded-full shadow-lg transition ${isRecording ? 'bg-red-500 scale-110' : 'bg-slate-200 text-slate-600'}`}
                 >
                    <Mic size={20} className={isRecording ? 'text-white animate-pulse' : ''} />
                 </button>
             )}
          </div>
        )}
        {isRecording && <div className="text-center text-xs text-red-500 mt-1">Recording... {recordingTime}s</div>}
      </div>
    </div>
  );
};