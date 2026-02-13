
import React, { useState, useRef, useEffect } from 'react';
import { AppNotification, User } from '../../types';
import { useSupabase } from '../../contexts/SupabaseContext';

type Theme = 'light' | 'dark';

interface HeaderProps {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleSidebar: () => void;
    notifications: AppNotification[];
    setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
    handleLogout: () => void;
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const roleNames: { [key in User['role']]: string } = {
    admin: 'Administrador',
    manager: 'Gerente',
    stockist: 'Estoquista'
};

export const Header: React.FC<HeaderProps> = ({ 
    theme, setTheme, toggleSidebar, notifications, setNotifications, 
    handleLogout, currentUser, setCurrentUser 
}) => {
    const supabase = useSupabase();
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    const handleNotifToggle = () => {
        setIsNotifOpen(prev => !prev);
    }
    
    const markAsRead = (id: string) => {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({...n, read: true})));
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            
            // Atualiza no banco de dados
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: base64 })
                .eq('id', currentUser.id);

            if (error) {
                console.error("Erro ao salvar foto:", error);
                alert("Falha ao salvar a foto de perfil.");
            } else {
                // Atualiza o estado local para refletir na interface imediatamente
                setCurrentUser({ ...currentUser, avatar_url: base64 });
            }
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    return (
        <header className="relative flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center">
                <button onClick={toggleSidebar} className="text-gray-500 dark:text-gray-400 focus:outline-none md:hidden mr-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">StockSys</h2>
            </div>
            <div className="flex items-center space-x-4">
                 <button onClick={toggleTheme} className="p-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary dark:focus:ring-offset-gray-800">
                    {theme === 'light' ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    )}
                </button>
                
                <div className="relative" ref={notifRef}>
                    <button onClick={handleNotifToggle} className="relative p-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>
                        )}
                    </button>
                    {isNotifOpen && (
                         <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20">
                            <div className="py-2 px-4 flex justify-between items-center border-b dark:border-gray-700">
                                <h4 className="text-gray-700 dark:text-gray-200 font-bold">Notificações</h4>
                                {unreadCount > 0 && <button onClick={markAllAsRead} className="text-xs text-blue-500 hover:underline">Marcar todas como lidas</button>}
                            </div>
                             <div className="max-h-80 overflow-y-auto">
                                {notifications.length > 0 ? notifications.map(notif => (
                                     <div key={notif.id} className={`flex items-start px-4 py-3 border-b dark:border-gray-700/50 ${!notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                        <div className="w-full">
                                            <p className="text-gray-600 dark:text-gray-300 text-sm">{notif.message}</p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString('pt-BR')}</p>
                                        </div>
                                         {!notif.read && <button onClick={() => markAsRead(notif.id)} className="ml-2 text-xs text-blue-500 hover:underline flex-shrink-0">Lida</button>}
                                     </div>
                                )) : (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma notificação.</p>
                                    </div>
                                )}
                             </div>
                         </div>
                    )}
                </div>

                <div className="relative" ref={profileRef}>
                    <button onClick={() => setIsProfileOpen(p => !p)} className="flex items-center focus:outline-none relative">
                        {isUploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full z-10">
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        )}
                        <img 
                            className="object-cover w-10 h-10 rounded-full border-2 border-primary" 
                            src={currentUser?.avatar_url || "https://ui-avatars.com/api/?name=" + (currentUser?.name || "User") + "&background=random"} 
                            alt="Avatar" 
                        />
                        <div className="ml-2 hidden sm:block text-left">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser ? roleNames[currentUser.role] : ''}</p>
                        </div>
                    </button>
                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20">
                            <ul>
                                <li>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handlePhotoUpload} 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 006 0z" /></svg>
                                        Alterar Foto
                                    </button>
                                </li>
                                <li>
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        Sair
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
