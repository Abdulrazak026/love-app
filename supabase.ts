import { createClient } from '@supabase/supabase-js';

// Specific project credentials provided by the user
const SUPABASE_URL = 'https://dhgexntbworzwbdftspq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoZ2V4bnRid29yendiZGZ0c3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDU3NjcsImV4cCI6MjA4MTAyMTc2N30.jae6S7YosOli9Hi8c_OK6J6mkhhB1WS8phmidu2fzZk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // Persist auth session (JWT) only
    storageKey: 'lulu_lala_auth',
  },
  // Removed custom realtime params to use defaults for maximum speed/instant delivery
  // We strictly do not use localStorage for application data, relying on online fetch & realtime.
});

// Helper to upload files
export const uploadFile = async (bucket: string, path: string, file: File | Blob): Promise<string | null> => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true
  });
  
  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
};