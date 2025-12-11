
export interface User {
  id: string;
  display_name: 'Lulu' | 'Lala';
  pin: string;
  avatar_url?: string;
  theme_color?: string;
  current_mood?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to: 'Lulu' | 'Lala' | 'Both';
  created_by: string;
  status: 'pending' | 'completed';
  due_date?: string;
  priority: 'low' | 'medium' | 'high';
  is_shared: boolean;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string; // 'Lulu' or 'Lala'
  content: string;
  created_at: string;
}

export interface ItineraryItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  notes?: string;
  created_at: string;
}

export interface FinanceItem {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  type: 'saving' | 'expense';
  created_at: string;
}

export interface LifeVisionItem {
  id: string;
  category: 'Career' | 'Living' | 'Health' | 'Dreams';
  content: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender: 'Lulu' | 'Lala';
  content: string; // Text or URL for image/audio
  type: 'text' | 'image' | 'audio';
  created_at: string;
  read_at?: string;
  harmony_softened?: boolean; // If Harmony AI softened it
  reactions?: Record<string, string>; // e.g., { 'Lulu': '❤️' }
  status?: 'sending' | 'sent' | 'error'; // UI only for optimistic updates
}

export interface Memory {
  id: string;
  title: string;
  date: string; // YYYY-MM
  photos: string[]; // URLs
  description?: string;
  created_at: string;
}

export interface RequestItem {
  id: string;
  from_user: 'Lulu' | 'Lala';
  type: 'date' | 'gift' | 'attention' | 'chore';
  details: string;
  status: 'pending' | 'accepted' | 'completed';
  created_at: string;
  target_date?: string;
  completed_at?: string;
}