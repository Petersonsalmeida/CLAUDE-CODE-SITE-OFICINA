
import React, { useState, useMemo, useEffect } from 'react';
import { NFe } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface NFControlProps {}

export const NFControl: React.FC<NFControlProps> = () => {
    const supabase = useSupabase();
    const [nfs, setNfs] = useState<NFe[]>([]);

    useEffect(() => {
        const fetchNFs = async () => {
            const { data, error } = await supabase.from('nfs').select('*');
            if(data) setNfs(data as unknown as NFe[]);
        };
        fetchNFs();

        const channel = supabase.channel('nfs-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'nfs' }, (payload) => {
            if (payload.eventType === 'INSERT') setNfs(current => [...current, payload.new as NFe]);
            if (payload.eventType === 'UPDATE') setNfs(current => current.map(item => item.id === payload.new.id ? payload.new as NFe : item));
            if (payload.eventType === 'DELETE') setNfs(current => current.filter(item => item.id !== (payload.old as NFe).id));
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        }

    }, [supabase]);

    const [searchTerm, setSearchTerm] = useState('');
    const [viewingNf, setViewingNf] = useState<NFe | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig<NFe> | null>(null);

    const filteredNfs = useMemo(() => {
        return nfs.filter(nf =>
            nf.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            nf.supplier.cnpj.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [nfs, searchTerm]);

    const requestSort = (key: keyof NFe) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedNfs = useMemo(() => {
        let sortableItems = [...filteredNfs];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key;
                const valA = a[key];
                const valB = b[key];
                
                if (typeof valA === 'object' || typeof valB === 'object') return 0;

                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        } else {
            sortableItems.sort((a,b) => new Date(b.import_date).getTime() - new Date(a.import_date).getTime());
        }
        return sortableItems;
    }, [filteredNfs, sortConfig]);

    const columns = [
        { header: 'Fornecedor', accessor: (item: NFe) => item.supplier.name, sortable: false },
        { header: 'CNPJ', accessor: (item: NFe) => item.supplier.cnpj, sortable: false },
        { header: 'Data de Importação', accessor: (item: NFe) => new Date(item.import_date).toLocaleString('pt-BR'), sortable: true, sortKey: 'import_date' as const },
        { header: 'Valor Total', accessor: (item: NFe) => item.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sortable: true, sortKey: 'total_value' as const },
    ];

    return (
        <div className="space-y-6">
            <div className="sm:flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Notas Fiscais</h2>
                    <p className="text-gray-500 dark:text-gray-400">Consulte o histórico de todas as NFs importadas.</p>
                </div>
            </div>
            
            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome do fornecedor ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<NFe>
                columns={columns}
                data={sortedNfs}
                actions={(nf) => (
                    <button onClick={() => setViewingNf(nf)} title="Ver Detalhes" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />

            <Modal isOpen={!!viewingNf} onClose={() => setViewingNf(null)} title={`Detalhes da NF - ${viewingNf?.supplier.name}`}>
                {viewingNf && (
                    <div className="space-y-4 text-sm">
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <p><strong>Fornecedor:</strong> {viewingNf.supplier.name}</p>
                            <p><strong>CNPJ:</strong> {viewingNf.supplier.cnpj}</p>
                            <p><strong>Data de Importação:</strong> {new Date(viewingNf.import_date).toLocaleString('pt-BR')}</p>
                            <p className="font-bold mt-2"><strong>Valor Total:</strong> {viewingNf.total_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200 pt-2 border-t dark:border-gray-600">Produtos</h4>
                        <div className="max-h-80 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Produto</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qtd.</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vlr. Un.</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Vlr. Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {viewingNf.products.map((p, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{p.name} ({p.code})</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{p.quantity}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{p.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{((Number(p.unit_price) || 0) * (Number(p.quantity) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
