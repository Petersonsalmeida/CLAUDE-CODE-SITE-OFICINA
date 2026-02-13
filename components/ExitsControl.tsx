
import React, { useState, useMemo, useEffect } from 'react';
import { StockMovement, User, ToastMessage, Employee, Product, CarPart } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface ExitsControlProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  currentUser: User;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
}

export const ExitsControl: React.FC<ExitsControlProps> = ({ addToast, currentUser, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [exits, setExits] = useState<StockMovement[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [viewingVoucher, setViewingVoucher] = useState<StockMovement | null>(null);
    const [editingExit, setEditingExit] = useState<StockMovement | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<StockMovement>>({ key: 'date', direction: 'descending' });
    const [isSaving, setIsSaving] = useState(false);

    const fetchExits = async () => {
        const { data, error } = await supabase
            .from('stock_movements')
            .select('*')
            .eq('type', 'out')
            .order('date', { ascending: false });
        
        if (data) setExits(data as unknown as StockMovement[]);
    };

    useEffect(() => {
        fetchExits();

        const fetchEmployees = async () => {
            const { data } = await supabase.from('employees').select('*');
            if (data) setEmployees(data);
        };
        fetchEmployees();

        const channel = supabase.channel('exits-control-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, (payload) => {
            if ((payload.new as any)?.type === 'out' || (payload.old as any)?.type === 'out') {
                fetchExits();
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [supabase]);

    const filteredExits = useMemo(() => {
        return exits.filter(e =>
            e.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (e.employee_name && e.employee_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (e.reason && e.reason.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [exits, searchTerm]);

    const requestSort = (key: keyof StockMovement) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedExits = useMemo(() => {
        let sortableItems = [...filteredExits];
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
    }, [filteredExits, sortConfig]);

    const handlePrintVoucher = () => {
        window.print();
    };

    const handleUndoExit = (exit: StockMovement) => {
        showConfirmation(`Deseja estornar esta saída? A quantidade de ${exit.quantity} retornará ao estoque de "${exit.product_name}".`, async () => {
            try {
                // 1. Verificar se é um produto ou uma peça
                const { data: product } = await supabase.from('products').select('*').eq('id', exit.product_id).maybeSingle();
                const { data: carPart } = await supabase.from('car_parts').select('*').eq('id', exit.product_id).maybeSingle();

                const targetTable = product ? 'products' : (carPart ? 'car_parts' : null);
                const currentQty = product?.quantity || carPart?.quantity || 0;

                if (!targetTable) throw new Error("Produto original não encontrado para estorno.");

                // 2. Devolver ao estoque
                const { error: updateError } = await supabase
                    .from(targetTable)
                    .update({ quantity: currentQty + exit.quantity })
                    .eq('id', exit.product_id);

                if (updateError) throw updateError;

                // 3. Remover o movimento
                const { error: deleteError } = await supabase
                    .from('stock_movements')
                    .delete()
                    .eq('id', exit.id);

                if (deleteError) throw deleteError;

                addToast('Saída estornada com sucesso! O estoque foi recomposto.', 'success');
                addActivityLog(`estornou a saída de ${exit.quantity}x ${exit.product_name}.`);
                fetchExits();
            } catch (error: any) {
                addToast(`Erro ao estornar: ${error.message}`, 'error');
            }
        });
    };

    const handleUpdateExit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingExit) return;
        setIsSaving(true);

        const formData = new FormData(e.currentTarget);
        const newQty = parseFloat(formData.get('quantity') as string);
        const newEmployeeId = formData.get('employee_id') as string;
        const newReason = formData.get('reason') as string;
        const employee = employees.find(emp => emp.id === newEmployeeId);

        try {
            // 1. Ajustar Estoque baseado na diferença
            const qtyDiff = editingExit.quantity - newQty; // Se positivo, devolver. Se negativo, retirar.
            
            const { data: product } = await supabase.from('products').select('*').eq('id', editingExit.product_id).maybeSingle();
            const { data: carPart } = await supabase.from('car_parts').select('*').eq('id', editingExit.product_id).maybeSingle();
            const targetTable = product ? 'products' : (carPart ? 'car_parts' : null);
            const currentStock = product?.quantity || carPart?.quantity || 0;

            if (targetTable) {
                if (currentStock + qtyDiff < 0) {
                    throw new Error("Saldo insuficiente no estoque para realizar este ajuste.");
                }

                await supabase
                    .from(targetTable)
                    .update({ quantity: currentStock + qtyDiff })
                    .eq('id', editingExit.product_id);
            }

            // 2. Atualizar Movimento
            const { error: moveError } = await supabase
                .from('stock_movements')
                .update({
                    quantity: newQty,
                    employee_id: newEmployeeId,
                    employee_name: employee?.name || editingExit.employee_name,
                    reason: newReason
                })
                .eq('id', editingExit.id);

            if (moveError) throw moveError;

            addToast('Registro de saída atualizado com sucesso!', 'success');
            addActivityLog(`editou registro de saída de ${editingExit.product_name}.`);
            setEditingExit(null);
            fetchExits();
        } catch (error: any) {
            addToast(`Erro ao atualizar: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const columns = [
        { header: 'Data e Hora', accessor: (item: StockMovement) => new Date(item.date).toLocaleString('pt-BR'), sortable: true, sortKey: 'date' as const },
        { header: 'Produto', accessor: 'product_name' as const, sortable: true },
        { header: 'Quantidade', accessor: 'quantity' as const, sortable: true },
        { header: 'Funcionário', accessor: 'employee_name' as const, sortable: true },
        { header: 'Motivo / Destino', accessor: 'reason' as const, sortable: true },
    ];

    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

    return (
        <div className="space-y-6">
            <div className="sm:flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Saídas de Material</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie, edite ou estorne registros de retirada de estoque.</p>
                </div>
            </div>

            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por produto, funcionário ou motivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>

            <Table<StockMovement>
                columns={columns}
                data={sortedExits}
                sortConfig={sortConfig}
                requestSort={requestSort}
                actions={(exit) => (
                    <div className="flex space-x-2">
                        <button 
                            onClick={() => setViewingVoucher(exit)} 
                            title="Ver Vale"
                            className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 p-1.5 rounded-md hover:bg-blue-200 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </button>
                        <button 
                            onClick={() => setEditingExit(exit)} 
                            title="Editar Saída"
                            className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 p-1.5 rounded-md hover:bg-indigo-200 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button 
                            onClick={() => handleUndoExit(exit)} 
                            title="Estornar (Devolver ao Estoque)"
                            className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 p-1.5 rounded-md hover:bg-red-200 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                    </div>
                )}
            />

            {/* Modal de Impressão de Vale */}
            <Modal isOpen={!!viewingVoucher} onClose={() => setViewingVoucher(null)} title="Vale de Saída de Material">
                {viewingVoucher && (
                    <div className="space-y-6 print:p-0">
                        <div id="voucher-content" className="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm relative">
                            <div className="flex justify-between items-start mb-8 border-b pb-4 dark:border-gray-700">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tighter">StockSys - Empresa</h3>
                                    <p className="text-xs text-gray-500 uppercase">Controle Interno de Estoque</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono text-gray-500">Documento Nº: {viewingVoucher.id.substring(0, 8)}</p>
                                    <p className="text-xs text-gray-400">{new Date(viewingVoucher.date).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold">Produto</p>
                                        <p className="text-lg font-medium text-gray-900 dark:text-white">{viewingVoucher.product_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase font-bold">Quantidade</p>
                                        <p className="text-lg font-medium text-gray-900 dark:text-white">{viewingVoucher.quantity} Unidades</p>
                                    </div>
                                </div>
                                <div className="border-t pt-4 dark:border-gray-700">
                                    <p className="text-xs text-gray-400 uppercase font-bold">Retirado por (Funcionário)</p>
                                    <p className="text-lg font-medium text-gray-900 dark:text-white">{viewingVoucher.employee_name || 'Não especificado'}</p>
                                </div>
                                <div className="border-t pt-4 dark:border-gray-700">
                                    <p className="text-xs text-gray-400 uppercase font-bold">Destino / Finalidade</p>
                                    <p className="text-gray-700 dark:text-gray-300 italic">"{viewingVoucher.reason || 'Uso geral'}"</p>
                                </div>
                            </div>
                            <div className="mt-12 flex flex-col items-center justify-center space-y-2">
                                <div className="w-full h-px bg-gray-300 dark:bg-gray-600 max-w-[300px]"></div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest">Assinatura do Funcionário</p>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-8 text-center italic border-t pt-2 dark:border-gray-700">Este documento comprova a retirada física do material do estoque central para fins operacionais.</p>
                        </div>
                        <div className="flex justify-end space-x-2 no-print">
                            <button onClick={() => setViewingVoucher(null)} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 transition">Fechar</button>
                            <button onClick={handlePrintVoucher} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition flex items-center">
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                Imprimir / Salvar PDF
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de Edição de Saída */}
            <Modal isOpen={!!editingExit} onClose={() => setEditingExit(null)} title="Ajustar Registro de Saída">
                {editingExit && (
                    <form onSubmit={handleUpdateExit} className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-500">Produto: <span className="font-bold text-gray-700 dark:text-gray-300">{editingExit.product_name}</span></p>
                            <p className="text-xs text-gray-400">Data original: {new Date(editingExit.date).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nova Quantidade</label>
                            <input 
                                type="number" 
                                name="quantity" 
                                step="0.01" 
                                defaultValue={editingExit.quantity} 
                                required 
                                className={formInputClass} 
                            />
                            <p className="text-[10px] text-gray-400 mt-1">O sistema ajustará o estoque automaticamente baseado na diferença.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Funcionário</label>
                            <select 
                                name="employee_id" 
                                defaultValue={editingExit.employee_id || ''} 
                                className={formInputClass}
                                required
                            >
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo / Observação</label>
                            <textarea 
                                name="reason" 
                                defaultValue={editingExit.reason || ''} 
                                className={formInputClass} 
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-4">
                            <button 
                                type="button" 
                                onClick={() => setEditingExit(null)} 
                                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition disabled:bg-gray-400"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body * { visibility: hidden; }
                    .no-print { display: none !important; }
                    #voucher-content, #voucher-content * { visibility: visible; }
                    #voucher-content { position: absolute; left: 0; top: 0; width: 100%; border: 1px solid #ccc; padding: 40px; }
                }
            `}} />
        </div>
    );
};
