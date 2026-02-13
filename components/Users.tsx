
import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { User, ToastMessage, UserRole } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface UsersProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Users: React.FC<UsersProps> = ({ addToast, showConfirmation, addActivityLog, currentUser }) => {
    const supabase = useSupabase();
    const [users, setUsers] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<User> | null>(null);
    const [orgInfo, setOrgInfo] = useState<{name: string, code: string} | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
            if (profilesError) {
                addToast(`Erro ao carregar usuários: ${profilesError.message}`, 'error');
            } else {
                const mappedUsers: User[] = (profilesData || []).map(p => ({
                    id: p.id,
                    name: p.full_name,
                    email: '', 
                    role: p.role as UserRole,
                }));
                setUsers(mappedUsers);
            }
        };
        fetchUsers();

        // Fetch Organization Info for Invite Code
        const fetchOrg = async () => {
            if(currentUser.organization_id) {
                const { data, error } = await supabase.from('organizations').select('*').eq('id', currentUser.organization_id).single();
                if (data) {
                    setOrgInfo({ name: data.name, code: data.invite_code });
                }
            }
        }
        fetchOrg();

        const channel = supabase.channel('profiles-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
            const mapProfileToUser = (p: any): User => ({
                id: p.id, name: p.full_name, email: '', role: p.role as UserRole,
             });
            if (payload.eventType === 'INSERT') {
                setUsers(current => [...current, mapProfileToUser(payload.new)]);
            }
            if (payload.eventType === 'UPDATE') {
                setUsers(current => current.map(item => item.id === payload.new.id ? mapProfileToUser(payload.new) : item));
            }
            if (payload.eventType === 'DELETE') {
                setUsers(current => current.filter(item => item.id !== (payload.old as any).id));
            }
        }).subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, addToast, currentUser.organization_id]);

    const filteredUsers = useMemo(() => {
        return users.filter(u =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [users, searchTerm]);

    const requestSort = (key: keyof User) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = useMemo(() => {
        let sortableItems = [...filteredUsers];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredUsers, sortConfig]);

    const openModal = (user: User | null = null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingUser(null);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingUser) return;

        const formData = new FormData(e.currentTarget);
        const newProfileData = {
            full_name: formData.get('name') as string,
            role: formData.get('role') as UserRole,
        };

        const originalUsers = users;
        setUsers(prev => prev.map(u => u.id === editingUser.id ? {...u, name: newProfileData.full_name, role: newProfileData.role} : u));

        const { error } = await supabase.from('profiles').update(newProfileData).eq('id', editingUser.id);

        if (error) {
            addToast(`Erro ao atualizar usuário: ${error.message}`, 'error');
            setUsers(originalUsers);
        } else {
            addToast('Usuário atualizado com sucesso!', 'success');
            addActivityLog(`atualizou o perfil de ${newProfileData.full_name}`);
        }
        
        closeModal();
    };

    const handleDelete = (user: User) => {
        if (user.id === currentUser.id) {
            addToast('Você não pode excluir seu próprio usuário.', 'error');
            return;
        }
        showConfirmation(`Tem certeza que deseja excluir o usuário ${user.name}? Esta ação não pode ser desfeita e removerá o acesso dele.`, () => {
             addToast('A exclusão de usuários deve ser feita no painel do Supabase por segurança.', 'info');
        });
    };
    
    const columns = [
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { header: 'Email', accessor: 'email' as const, sortable: true },
        { header: 'Permissão', accessor: 'role' as const, sortable: true },
    ];
    
    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Usuários da Organização</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie os acessos ao sistema.</p>
                </div>
            </div>

            {orgInfo && currentUser.role === 'admin' && (
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-6 rounded-lg border border-indigo-200 dark:border-indigo-700 flex flex-col md:flex-row justify-between items-center shadow-sm">
                    <div>
                        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">Sua Organização: {orgInfo.name}</h3>
                        <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">Envie o código abaixo para seus funcionários se cadastrarem no sistema e acessarem a mesma base de dados.</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex items-center bg-white dark:bg-gray-800 px-4 py-2 rounded-md border border-indigo-300 dark:border-gray-600">
                        <span className="font-mono text-xl font-bold tracking-widest text-gray-800 dark:text-gray-100 mr-3">{orgInfo.code}</span>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(orgInfo.code);
                                addToast('Código copiado!', 'success');
                            }}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 text-sm font-medium"
                        >
                            Copiar
                        </button>
                    </div>
                </div>
            )}

            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<User>
                columns={columns}
                data={sortedUsers}
                actions={(user) => (
                    <>
                        <button onClick={() => openModal(user)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(user)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={'Editar Usuário'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome</label>
                        <input type="text" name="name" id="name" defaultValue={editingUser?.name} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="email" className={formLabelClass}>Email</label>
                        <input type="email" name="email" id="email" defaultValue={editingUser?.email} required className={formInputClass} disabled/>
                    </div>
                    <div>
                        <label htmlFor="role" className={formLabelClass}>Permissão</label>
                        <select name="role" id="role" defaultValue={editingUser?.role || 'stockist'} className={formInputClass} disabled={editingUser?.id === currentUser.id}>
                            <option value="stockist">Estoquista</option>
                            <option value="manager">Gerente</option>
                            <option value="admin">Administrador</option>
                        </select>
                         {editingUser?.id === currentUser.id && <p className="text-xs text-gray-500 mt-1">Você não pode alterar sua própria permissão.</p>}
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};