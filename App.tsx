import React, { useState, useEffect } from 'react';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Chat } from './pages/Chat';
import { Plans } from './pages/Plans';
import { Memories } from './pages/Memories';
import { Requests } from './pages/Requests';
import { Layout } from './components/Layout';
import { User } from './types';
import { supabase } from './supabase';

// Simple Router (Hash based for PWA without server config)
const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    // In a real app with Supabase Auth persistence, we'd check supabase.auth.getSession()
    // For this customized flow where we store user profile in state after PIN:
    // We start fresh or could load from a session token if we implemented full auth.
    // Assuming clean start for demo purposes or "Keep me logged in" simply by not refreshing.
    setLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const refreshUser = async () => {
      if (!currentUser) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
      if (data) setCurrentUser(data as User);
  };

  const renderContent = () => {
    if (!currentUser) return <Auth onLogin={handleLogin} />;

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard currentUser={currentUser} onRequestClick={() => setActiveTab('requests')} onProfileUpdate={refreshUser} onLogout={() => setCurrentUser(null)} />;
      case 'requests':
        return <Requests currentUser={currentUser} onBack={() => setActiveTab('dashboard')} />;
      case 'chat':
        return <Chat currentUser={currentUser} />;
      case 'plans':
        return <Plans currentUser={currentUser} />;
      case 'memories':
        return <Memories currentUser={currentUser} />;
      default:
        return <Dashboard currentUser={currentUser} onRequestClick={() => setActiveTab('requests')} onProfileUpdate={refreshUser} onLogout={() => setCurrentUser(null)} />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-rose-50 text-rose-500">Loading Love...</div>;

  return (
    <>
      {currentUser ? (
        <Layout 
          activeTab={activeTab === 'requests' ? 'dashboard' : activeTab} 
          onTabChange={setActiveTab} 
          currentUser={currentUser}
          unreadCount={0} // To be connected to realtime count
        >
          {renderContent()}
        </Layout>
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </>
  );
};

export default App;