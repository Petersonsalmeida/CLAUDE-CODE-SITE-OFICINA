
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { createSupabaseClient } from './services/supabaseClient';
import { Login } from './components/Login';
import { Sidebar } from './components/shared/Sidebar';
import { Header } from './components/shared/Header';
import { Dashboard } from './components/Dashboard';
import { StockControl } from './components/StockControl';
import { CarParts } from './components/CarParts';
import { Suppliers } from './components/Suppliers';
import { Clients } from './components/Clients';
import { Employees } from './components/Employees';
import { Users } from './components/Users';
import { Assets } from './components/Assets';
import { Categories } from './components/Categories';
import { Reports } from './components/Reports';
import { Quotes } from './components/Quotes';
import { NFControl } from './components/NFControl';
import { WorkOrders } from './components/WorkOrders';
import { PurchaseOrders } from './components/PurchaseOrders';
import { ActivityLog } from './components/ActivityLog';
import { ExitsControl } from './components/ExitsControl';
import { ToastContainer } from './components/shared/ToastContainer';
import ConfirmationModal from './components/shared/ConfirmationModal';
import { SupabaseSetup } from './components/SupabaseSetup';
import { User, AppNotification, ToastMessage, UserRole } from './types';

const App: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useLocalStorage<string | null>('supabaseUrl', null);
  const [supabaseKey, setSupabaseKey] = useLocalStorage<string | null>('supabaseKey', null);
  
  // isConfigured agora é derivado, então ele muda sempre que a URL ou Key mudarem
  const isConfigured = !!(supabaseUrl && supabaseKey);

  const [supabaseClient, setSupabaseClient] = useState(() => {
    if (supabaseUrl && supabaseKey) {
        try {
            return createSupabaseClient(supabaseUrl, supabaseKey);
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
            return null;
        }
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState<any>('dashboard');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Atualiza o cliente Supabase quando a configuração muda
  useEffect(() => {
    if (isConfigured && supabaseUrl && supabaseKey) {
      try {
        setSupabaseClient(createSupabaseClient(supabaseUrl, supabaseKey));
      } catch (e) {
        console.error("Effect: Failed to initialize Supabase client:", e);
      }
    } else {
      setSupabaseClient(null);
    }
  }, [isConfigured, supabaseUrl, supabaseKey]);

  useEffect(() => {
    if (!supabaseClient) return;

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else setCurrentUser(null);
    });

    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  const fetchProfile = async (userId: string) => {
    if (!supabaseClient) return;
    const { data } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setCurrentUser({
        id: data.id,
        name: data.full_name,
        email: session?.user?.email,
        role: data.role as UserRole,
        organization_id: data.organization_id ?? undefined,
        avatar_url: data.avatar_url ?? undefined
      });
    }
  };

  const addToast = (message: string, type: ToastMessage['type']) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const showConfirmation = (message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, message, onConfirm: () => { onConfirm(); setConfirmModal(null); } });
  };

  const addActivityLog = async (action: string) => {
    if (!supabaseClient || !currentUser) return;
    await supabaseClient.from('activity_logs').insert({
      user: currentUser.name,
      action: action,
      timestamp: new Date().toISOString()
    });
  };

  const handleLogout = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut();
  };

  if (!isConfigured || !supabaseClient) {
    return (
      <SupabaseSetup 
        onConfigured={(url, key) => {
          setSupabaseUrl(url);
          setSupabaseKey(key);
        }} 
      />
    );
  }

  if (!session) {
    return (
      <SupabaseProvider client={supabaseClient}>
        <Login />
      </SupabaseProvider>
    );
  }

  const renderPage = () => {
    const props = { addToast, showConfirmation, addActivityLog, currentUser: currentUser! };
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'stock': return <StockControl {...props} />;
      case 'carParts': return <CarParts {...props} />;
      case 'suppliers': return <Suppliers {...props} />;
      case 'clients': return <Clients {...props} />;
      case 'employees': return <Employees {...props} />;
      case 'users': return <Users {...props} />;
      case 'assets': return <Assets {...props} />;
      case 'categories': return <Categories {...props} />;
      case 'reports': return <Reports />;
      case 'quotes': return <Quotes {...props} />;
      case 'nfcontrol': return <NFControl />;
      case 'workorders': return <WorkOrders {...props} />;
      case 'purchaseorders': return <PurchaseOrders {...props} />;
      case 'activitylog': return <ActivityLog />;
      case 'exits': return <ExitsControl {...props} />;
      default: return <Dashboard />;
    }
  };

  return (
    <SupabaseProvider client={supabaseClient}>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
        <Sidebar 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen}
          currentUser={currentUser}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            theme={theme} 
            setTheme={setTheme} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            notifications={notifications}
            setNotifications={setNotifications}
            handleLogout={handleLogout}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
            {renderPage()}
          </main>
        </div>
        <ToastContainer toasts={toasts} />
        {confirmModal && (
          <ConfirmationModal 
            isOpen={confirmModal.isOpen} 
            message={confirmModal.message} 
            onConfirm={confirmModal.onConfirm} 
            onClose={() => setConfirmModal(null)} 
          />
        )}
      </div>
    </SupabaseProvider>
  );
};

export default App;
