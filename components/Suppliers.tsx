import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Supplier, ToastMessage, User } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface SuppliersProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Suppliers: React.FC<SuppliersProps> = ({ addToast, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<Supplier> | null>(null);

    useEffect(() => {
        const fetchSuppliers = async () => {
            const { data, error } = await supabase.from('suppliers').select('*');
            if (error) {
                addToast(`Erro ao carregar fornecedores: ${error.message}`, 'error');
            } else if (data) {
                setSuppliers(data);
            }
        };
        fetchSuppliers();

        const channel = supabase.channel('suppliers-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                setSuppliers(current => {
                    if (current.some(item => item.id === payload.new.id)) return current;
                    return [...current, payload.new as Supplier]
                });
            }
            if (payload.eventType === 'UPDATE') {
                setSuppliers(current => current.map(item => item.id === payload.new.id ? payload.new as Supplier : item));
            }
            if (payload.eventType === 'DELETE') {
                setSuppliers(current => current.filter(item => item.id !== (payload.old as Supplier).id));
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, addToast]);


    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.cnpj.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [suppliers, searchTerm]);

    const requestSort = (key: keyof Supplier) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedSuppliers = useMemo(() => {
        let sortableItems = [...filteredSuppliers];
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
    }, [filteredSuppliers, sortConfig]);

    const openModal = (supplier: Supplier | null = null) => {
        setCurrentSupplier(supplier);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setCurrentSupplier(null);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        
        const supplierData = {
            name: formData.get('name') as string,
            cnpj: formData.get('cnpj') as string,
            contact: formData.get('contact') as string,
            address: formData.get('address') as string,
            whatsapp: formData.get('whatsapp') as string,
        };

        if (currentSupplier) { // Update
            const originalSuppliers = suppliers;
            setSuppliers(prev => prev.map(s => s.id === currentSupplier.id ? {...s, ...supplierData} : s));
            const { error } = await supabase.from('suppliers').update(supplierData).eq('id', currentSupplier.id);
            if (error) {
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                setSuppliers(originalSuppliers); // Revert
            } else {
                addToast('Fornecedor atualizado com sucesso!', 'success');
                addActivityLog(`atualizou o fornecedor: ${supplierData.name}`);
            }
        } else { // Insert
            const { data, error } = await supabase.from('suppliers').insert(supplierData).select().single();
            if (error) {
                addToast(`Erro ao criar: ${error.message}`, 'error');
            } else if (data) {
                setSuppliers(prev => [...prev, data]); // Manual update
                addToast('Fornecedor criado com sucesso!', 'success');
                addActivityLog(`criou o fornecedor: ${supplierData.name}`);
            }
        }
        setIsSaving(false);
        closeModal();
    };

    const handleDelete = (supplier: Supplier) => {
        showConfirmation('Tem certeza que deseja excluir este fornecedor?', async () => {
            const originalSuppliers = suppliers;
            setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
            const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id);
             if (error) {
                addToast(`Erro ao excluir: ${error.message}`, 'error');
                setSuppliers(originalSuppliers);
            } else {
                addToast('Fornecedor excluído com sucesso!', 'success');
                addActivityLog(`excluiu o fornecedor: ${supplier.name}`);
            }
        });
    };
    
    const columns = [
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { header: 'CNPJ', accessor: 'cnpj' as const, sortable: true },
        { header: 'Contato', accessor: 'contact' as const, sortable: true },
        { header: 'Endereço', accessor: 'address' as const, sortable: true },
        { header: 'WhatsApp', accessor: 'whatsapp' as const, sortable: true },
    ];
    
    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Fornecedores</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie seus parceiros comerciais.</p>
                </div>
                <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                    Novo Fornecedor
                </button>
            </div>

             <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<Supplier>
                columns={columns}
                data={sortedSuppliers}
                actions={(supplier) => (
                    <>
                        <button onClick={() => openModal(supplier)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(supplier)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome</label>
                        <input type="text" name="name" id="name" defaultValue={currentSupplier?.name} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="cnpj" className={formLabelClass}>CNPJ</label>
                        <input type="text" name="cnpj" id="cnpj" defaultValue={currentSupplier?.cnpj} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="contact" className={formLabelClass}>Contato</label>
                        <input type="text" name="contact" id="contact" defaultValue={currentSupplier?.contact || ''} className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="address" className={formLabelClass}>Endereço</label>
                        <input type="text" name="address" id="address" defaultValue={currentSupplier?.address || ''} className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="whatsapp" className={formLabelClass}>WhatsApp</label>
                        <input type="tel" name="whatsapp" id="whatsapp" defaultValue={currentSupplier?.whatsapp || ''} placeholder="Ex: 5511999998888" className={formInputClass}/>
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