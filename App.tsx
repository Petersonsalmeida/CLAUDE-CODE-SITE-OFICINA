
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createSupabaseClient } from './services/supabaseClient';
import { SupabaseProvider, useSupabase } from './contexts/SupabaseContext';
import { SupabaseSetup } from './components/SupabaseSetup';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types/supabase';

import { Sidebar } from './components/shared/Sidebar';
import { Header } from './components/shared/Header';
import { Dashboard } from './components/Dashboard';
import { StockControl } from './components/StockControl';
import { Suppliers } from './components/Suppliers';
import { Clients } from './components/Clients';
import { Employees } from './components/Employees';
import { Users } from './components/Users';
import { Assets } from './components/Assets';
import { Categories } from './components/Categories';
import { Reports } from './components/Reports';
import { CarParts } from './components/CarParts';
import { Quotes } from './components/Quotes';
import { Login } from './components/Login';
import { NFControl } from './components/NFControl';
import { WorkOrders } from './components/WorkOrders';
import { PurchaseOrders } from './components/PurchaseOrders';
import { ActivityLog } from './components/ActivityLog';
import { ExitsControl } from './components/ExitsControl';
import { User, AppNotification, ToastMessage } from './types';
import { ToastContainer } from './components/shared/ToastContainer';
import ConfirmationModal from './components/shared/ConfirmationModal';

type Page = 'dashboard' | 'stock' | 'carParts' | 'suppliers' | 'clients' | 'employees' | 'users' | 'assets' | 'categories' | 'reports' | 'quotes' | 'nfcontrol' | 'workorders' | 'purchaseorders' | 'activitylog' | 'exits';
type Theme = 'light' | 'dark';

const REQUIRED_SQL_SCRIPT = `-- 1. TABELA DE ORGANIZAÇÕES
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Minha Empresa',
  invite_code text NOT NULL DEFAULT substr(md5(random()::text), 0, 8),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. TABELA DE PERFIS (Incluindo avatar_url)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  role text DEFAULT 'stockist',
  organization_id uuid REFERENCES public.organizations(id),
  avatar_url text
);

-- ADICIONA COLUNA SE JÁ EXISTIR A TABELA SEM ELA
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- 3. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  min_stock numeric DEFAULT 10,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. TABELA DE FORNECEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cnpj text UNIQUE NOT NULL,
  contact text,
  address text,
  whatsapp text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cpf text NOT NULL,
  birth_date text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7. TABELA DE FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  contact text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 8. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL,
  product_name text NOT NULL,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  quantity numeric NOT NULL,
  date timestamp with time zone DEFAULT now() NOT NULL,
  reason text,
  employee_id uuid REFERENCES public.employees(id),
  employee_name text,
  receipt_photo text,
  work_order_id uuid,
  organization_id uuid REFERENCES public.organizations(id)
);

-- 9. TABELA DE NOTAS FISCAIS (NFs)
CREATE TABLE IF NOT EXISTS public.nfs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier jsonb NOT NULL,
  products jsonb NOT NULL,
  total_value numeric NOT NULL,
  import_date timestamp with time zone DEFAULT now() NOT NULL,
  organization_id uuid REFERENCES public.organizations(id)
);

-- 10. TABELA DE HISTÓRICO DE PREÇOS
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id text NOT NULL,
  price numeric NOT NULL,
  date timestamp with time zone DEFAULT now() NOT NULL,
  organization_id uuid REFERENCES public.organizations(id)
);

-- 11. TABELA DE ATIVOS
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  value numeric DEFAULT 0,
  location text,
  acquisition_date text,
  photo text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 12. TABELA DE MANUTENÇÕES
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  date text NOT NULL,
  description text NOT NULL,
  cost numeric DEFAULT 0,
  type text NOT NULL CHECK (type IN ('completed', 'scheduled')),
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 13. TABELA DE PEÇAS AUTOMOTIVAS
CREATE TABLE IF NOT EXISTS public.car_parts (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  description text,
  vehicle_model text,
  quantity numeric DEFAULT 0,
  location text,
  photo text,
  unit_price numeric DEFAULT 0,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 14. TABELA DE ORÇAMENTOS
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  items jsonb NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 15. TABELA DE ORDENS DE SERVIÇO
CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'completed')),
  items jsonb NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 16. TABELA DE ORDENS DE COMPRA
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'received')),
  items jsonb NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 17. TABELA DE LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user" text NOT NULL,
  action text NOT NULL,
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  organization_id uuid REFERENCES public.organizations(id)
);

-- HABILITAR RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO E GATILHOS
CREATE OR REPLACE FUNCTION public.handle_new_data_organization()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id := (SELECT organization_id FROM public.profiles WHERE id = auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('organizations', 'profiles')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_org_id_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER set_org_id_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_new_data_organization()', t, t);
    END LOOP;
END $$;

-- POLÍTICAS
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('organizations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Org isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Org isolation" ON public.%I FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))', t);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "Leitura pública de organizações" ON public.organizations;
CREATE POLICY "Leitura pública de organizações" ON public.organizations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Inserção pública de organizações" ON public.organizations;
CREATE POLICY "Inserção pública de organizações" ON public.organizations FOR INSERT WITH CHECK (true);
`;

const AppContent: React.FC = () => {
  const supabase = useSupabase();

  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Persist current page to avoid losing place on reload
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const saved = localStorage.getItem('stock_sys_current_page');
    return (saved as Page) || 'dashboard';
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [dbSetupRequired, setDbSetupRequired] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('stock_sys_current_page', currentPage);
  }, [currentPage]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const showConfirmation = useCallback((message: string, onConfirm: () => void) => {
    setConfirmation({ isOpen: true, message, onConfirm: () => {
        onConfirm();
        setConfirmation({ isOpen: false, message: '', onConfirm: () => {} });
    }});
  }, []);

  const closeConfirmation = () => setConfirmation({ isOpen: false, message: '', onConfirm: () => {} });

  useEffect(() => {
    const initSession = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) console.error("Error retrieving session:", error);
            if (session) {
                setSession(session);
                lastUserId.current = session.user.id;
            }
        } catch (e) {
            console.error("Unexpected error during session init:", e);
        }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Only trigger a state update if the user has actually changed to prevent refresh loops on focus
      if (newSession?.user.id !== lastUserId.current) {
        setSession(newSession);
        lastUserId.current = newSession?.user.id || null;
      }
      if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          lastUserId.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);
  
  const fetchUserProfile = useCallback(async () => {
    if (session?.user) {
      // Don't set loading if we already have a user, to prevent UI flicker on background sync
      if (!currentUser) setIsProfileLoading(true);
      
      try {
          const { error: checkError } = await supabase.from('organizations').select('id').limit(1);
          if (checkError && (checkError.code === '42P01' || checkError.message?.includes('Failed to fetch'))) { 
              setDbSetupRequired(true);
              setIsProfileLoading(false);
              return;
          }

          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            setCurrentUser({
              id: data.id,
              name: data.full_name,
              email: session.user.email!,
              role: data.role as User['role'],
              organization_id: data.organization_id || undefined,
              avatar_url: data.avatar_url,
            });
          } else if (error && error.code === 'PGRST116') {
             const { data: newOrg } = await supabase.from('organizations').insert({ name: 'Minha Empresa' }).select().single();
             if (newOrg) {
                 const { data: newProfile } = await supabase.from('profiles').insert({
                     id: session.user.id,
                     full_name: session.user.email?.split('@')[0] || 'Usuário',
                     role: 'admin',
                     organization_id: newOrg.id
                 }).select().single();
                 if (newProfile) {
                      setCurrentUser({
                          id: newProfile.id,
                          name: newProfile.full_name,
                          email: session.user.email!,
                          role: 'admin',
                          organization_id: newOrg.id,
                          avatar_url: null,
                      });
                 }
             }
          }
      } catch (e) {
          console.error("Error loading profile:", e);
          addToast("Erro ao conectar com o banco de dados.", "error");
      } finally {
          setIsProfileLoading(false);
      }
    }
  }, [session, supabase, addToast, currentUser]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const addActivityLog = useCallback(async (action: string) => {
    if (!currentUser) return;
    await supabase.from('activity_logs').insert({ user: currentUser.name, action });
  }, [currentUser, supabase]);

  const handleLogout = async () => {
    await addActivityLog('fez logout do sistema.');
    await supabase.auth.signOut();
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const renderPage = () => {
    if (!currentUser) return null;
    const commonProps = { addToast, showConfirmation, currentUser, addActivityLog };
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'stock': return <StockControl {...commonProps} />;
      case 'carParts': return <CarParts {...commonProps} />;
      case 'suppliers': return <Suppliers {...commonProps} />;
      case 'clients': return <Clients {...commonProps} />;
      case 'employees': return <Employees {...commonProps} />;
      case 'users': return <Users {...commonProps} />;
      case 'assets': return <Assets {...commonProps} />;
      case 'categories': return <Categories {...commonProps} />;
      case 'nfcontrol': return <NFControl />;
      case 'reports': return <Reports />;
      case 'quotes': return <Quotes {...commonProps} />;
      case 'workorders': return <WorkOrders {...commonProps} />;
      case 'purchaseorders': return <PurchaseOrders {...commonProps} />;
      case 'activitylog': return <ActivityLog />;
      case 'exits': return <ExitsControl {...commonProps} />;
      default: return <Dashboard />;
    }
  };

  if (!session) return <Login />;

  if (dbSetupRequired) {
      return (
          <div className="flex min-h-screen bg-gray-900 text-white p-4">
              <div className="m-auto w-full max-w-4xl bg-gray-800 rounded-lg shadow-2xl border border-gray-700">
                  <div className="p-6 bg-red-600 rounded-t-lg">
                      <h2 className="text-2xl font-bold flex items-center">
                          <svg className="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                          Configuração Necessária
                      </h2>
                  </div>
                  <div className="p-8 space-y-6">
                      <p className="text-gray-300">O banco de dados precisa ser atualizado ou inicializado. Copie e execute o script abaixo no SQL Editor do Supabase:</p>
                      <div className="relative">
                          <pre className="bg-black p-4 rounded text-sm text-green-400 font-mono border border-gray-600 max-h-96 overflow-auto">{REQUIRED_SQL_SCRIPT}</pre>
                          <button onClick={() => { navigator.clipboard.writeText(REQUIRED_SQL_SCRIPT); addToast('SQL copiado!', 'success'); }} className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">Copiar</button>
                      </div>
                      <div className="flex justify-end">
                          <button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold">Já executei o SQL, entrar</button>
                      </div>
                  </div>
              </div>
              <ToastContainer toasts={toasts} />
          </div>
      );
  }

  if (isProfileLoading) {
      return (
          <div className="flex h-screen items-center justify-center bg-gray-900">
              <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
      );
  }

  return (
    <>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} currentUser={currentUser} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header 
            theme={theme} 
            setTheme={setTheme} 
            toggleSidebar={() => setIsSidebarOpen(prev => !prev)} 
            notifications={notifications} 
            setNotifications={setNotifications} 
            handleLogout={handleLogout} 
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{renderPage()}</main>
        </div>
      </div>
      <ToastContainer toasts={toasts} />
      <ConfirmationModal isOpen={confirmation.isOpen} onClose={closeConfirmation} onConfirm={confirmation.onConfirm} message={confirmation.message} />
    </>
  );
};

const App: React.FC = () => {
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(() => {
    const env = (import.meta as any).env;
    if (env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_ANON_KEY) {
        try { return createSupabaseClient(); } catch (e) { console.error(e); }
    }
    const url = localStorage.getItem('supabaseUrl');
    const key = localStorage.getItem('supabaseKey');
    if (url && key) {
      try { return createSupabaseClient(url, key); } catch (e) { return null; }
    }
    return null;
  });

  const handleConfigured = () => {
    const url = localStorage.getItem('supabaseUrl');
    const key = localStorage.getItem('supabaseKey');
    if (url && key) setSupabaseClient(createSupabaseClient(url, key));
  };

  if (!supabaseClient) return <SupabaseSetup onConfigured={handleConfigured} />;

  return (
    <SupabaseProvider client={supabaseClient}>
      <AppContent />
    </SupabaseProvider>
  );
};

export default App;
