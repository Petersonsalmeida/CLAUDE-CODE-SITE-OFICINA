
import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Client, ToastMessage, User } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';
import { consultarCPF } from '../services/serproService';

interface ClientsProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Clients: React.FC<ClientsProps> = ({ addToast, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchingCPF, setIsSearchingCPF] = useState(false);
    
    const [currentClient, setCurrentClient] = useState<Partial<Client> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<Client> | null>(null);

    useEffect(() => {
        const fetchClients = async () => {
            const { data, error } = await supabase.from('clients').select('*');
            if (error) {
                if (error.code === '42P01') {
                    addToast(`Tabela 'clients' não encontrada. Por favor, execute o script SQL atualizado.`, 'error');
                } else {
                    addToast(`Erro ao carregar clientes: ${error.message}`, 'error');
                }
            } else if (data) {
                setClients(data);
            }
        };
        fetchClients();

        const channel = supabase.channel('clients-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                setClients(current => {
                    if (current.some(item => item.id === payload.new.id)) return current;
                    return [...current, payload.new as Client]
                });
            }
            if (payload.eventType === 'UPDATE') {
                setClients(current => current.map(item => item.id === payload.new.id ? payload.new as Client : item));
            }
            if (payload.eventType === 'DELETE') {
                setClients(current => current.filter(item => item.id !== (payload.old as Client).id));
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, addToast]);


    const filteredClients = useMemo(() => {
        return clients.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cpf.includes(searchTerm)
        );
    }, [clients, searchTerm]);

    const requestSort = (key: keyof Client) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedClients = useMemo(() => {
        let sortableItems = [...filteredClients];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredClients, sortConfig]);

    const openModal = (client: Client | null = null) => {
        setCurrentClient(client ? { ...client } : { name: '', cpf: '', birth_date: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '' });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setCurrentClient(null);
        setIsModalOpen(false);
    };

    const handleSearchCPF = async () => {
        const cpf = currentClient?.cpf || '';
        if (cpf.length < 11) {
            addToast('Digite um CPF válido para buscar.', 'warning');
            return;
        }

        setIsSearchingCPF(true);
        try {
            const data = await consultarCPF(cpf, supabase);
            
            // Constrói o endereço completo
            let fullAddress = data.logradouro || '';
            if (data.numero) fullAddress += `, ${data.numero}`;
            if (data.complemento) fullAddress += ` (${data.complemento})`;
            if (data.bairro) fullAddress += ` - ${data.bairro}`;
            
            const hasAddressData = !!(data.logradouro || data.cidade);

            setCurrentClient(prev => ({
                ...prev,
                name: data.nome,
                birth_date: data.birthDate || prev?.birth_date || '',
                address: fullAddress || prev?.address || '',
                city: data.cidade || prev?.city || '',
                state: data.uf || prev?.state || '',
                zip_code: data.cep || prev?.zip_code || '',
            }));
            
            if (data.situacaoCadastral && data.situacaoCadastral !== 'REGULAR') {
                addToast(`Atenção: Situação Cadastral ${data.situacaoCadastral}`, 'warning');
            } else {
                addToast('CPF validado com sucesso!', 'success');
            }

            if (!hasAddressData) {
                addToast('O SERPRO retornou apenas o Nome/Situação (Endereço indisponível neste contrato).', 'info');
            }

        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Erro ao consultar SERPRO', 'error');
        } finally {
            setIsSearchingCPF(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        
        const clientData = {
            name: formData.get('name') as string,
            cpf: formData.get('cpf') as string,
            birth_date: formData.get('birth_date') as string || null,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            address: formData.get('address') as string,
            city: formData.get('city') as string,
            state: formData.get('state') as string,
            zip_code: formData.get('zip_code') as string,
        };

        if (currentClient?.id) { // Update
            const originalClients = clients;
            setClients(prev => prev.map(c => c.id === currentClient.id ? {...c, ...clientData} as Client : c));
            const { error } = await supabase.from('clients').update(clientData).eq('id', currentClient.id);
            if (error) {
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                setClients(originalClients); // Revert
            } else {
                addToast('Cliente atualizado com sucesso!', 'success');
                addActivityLog(`atualizou o cliente: ${clientData.name}`);
            }
        } else { // Insert
            const { data, error } = await supabase.from('clients').insert(clientData).select().single();
            if (error) {
                if (error.code === '42P01') {
                    addToast(`Erro ao criar: A tabela 'clients' não existe. Execute o SQL de configuração.`, 'error');
                } else {
                    addToast(`Erro ao criar: ${error.message}`, 'error');
                }
            } else if (data) {
                setClients(prev => [...prev, data]);
                addToast('Cliente criado com sucesso!', 'success');
                addActivityLog(`criou o cliente: ${clientData.name}`);
            }
        }
        setIsSaving(false);
        closeModal();
    };

    const handleDelete = (client: Client) => {
        showConfirmation('Tem certeza que deseja excluir este cliente?', async () => {
            const originalClients = clients;
            setClients(prev => prev.filter(c => c.id !== client.id));
            const { error } = await supabase.from('clients').delete().eq('id', client.id);
             if (error) {
                addToast(`Erro ao excluir: ${error.message}`, 'error');
                setClients(originalClients);
            } else {
                addToast('Cliente excluído com sucesso!', 'success');
                addActivityLog(`excluiu o cliente: ${client.name}`);
            }
        });
    };
    
    const columns = [
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { header: 'CPF', accessor: 'cpf' as const, sortable: true },
        { header: 'Data Nasc.', accessor: (item: Client) => item.birth_date ? new Date(item.birth_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-', sortable: true, sortKey: 'birth_date' as const},
        { header: 'Telefone', accessor: 'phone' as const, sortable: true },
        { header: 'Cidade/UF', accessor: (item: Client) => `${item.city || ''} / ${item.state || ''}`, sortable: true, sortKey: 'city' as const},
    ];
    
    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Base de Clientes</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie seus clientes e consulte dados via SERPRO.</p>
                </div>
                <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                    Novo Cliente
                </button>
            </div>

             <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<Client>
                columns={columns}
                data={sortedClients}
                actions={(client) => (
                    <>
                        <button onClick={() => openModal(client)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(client)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentClient?.id ? 'Editar Cliente' : 'Novo Cliente'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="cpf" className={formLabelClass}>CPF</label>
                        <div className="flex space-x-2">
                             <input 
                                type="text" 
                                name="cpf" 
                                id="cpf" 
                                value={currentClient?.cpf || ''}
                                onChange={e => setCurrentClient(prev => prev ? {...prev, cpf: e.target.value} : null)}
                                required 
                                className={formInputClass}
                            />
                            <button 
                                type="button" 
                                onClick={handleSearchCPF}
                                disabled={isSearchingCPF}
                                className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center whitespace-nowrap"
                            >
                                {isSearchingCPF ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                    Buscar SERPRO
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Busca automática preenche Nome, Data Nasc. e Endereço.</p>
                    </div>
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome Completo</label>
                        <input type="text" name="name" id="name" defaultValue={currentClient?.name} required className={formInputClass}/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="birth_date" className={formLabelClass}>Data de Nascimento</label>
                            <input 
                                type="date" 
                                name="birth_date" 
                                id="birth_date" 
                                value={currentClient?.birth_date || ''} 
                                onChange={e => setCurrentClient(prev => prev ? {...prev, birth_date: e.target.value} : null)}
                                className={formInputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="phone" className={formLabelClass}>Telefone</label>
                            <input type="text" name="phone" id="phone" defaultValue={currentClient?.phone || ''} className={formInputClass}/>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="email" className={formLabelClass}>Email</label>
                        <input type="email" name="email" id="email" defaultValue={currentClient?.email || ''} className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="address" className={formLabelClass}>Endereço</label>
                        <input type="text" name="address" id="address" defaultValue={currentClient?.address || ''} className={formInputClass}/>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="city" className={formLabelClass}>Cidade</label>
                            <input type="text" name="city" id="city" defaultValue={currentClient?.city || ''} className={formInputClass}/>
                        </div>
                        <div>
                            <label htmlFor="state" className={formLabelClass}>Estado</label>
                            <input type="text" name="state" id="state" defaultValue={currentClient?.state || ''} className={formInputClass} maxLength={2}/>
                        </div>
                        <div>
                            <label htmlFor="zip_code" className={formLabelClass}>CEP</label>
                            <input type="text" name="zip_code" id="zip_code" defaultValue={currentClient?.zip_code || ''} className={formInputClass}/>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary disabled:bg-gray-400">
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
