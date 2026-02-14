
import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { PurchaseOrder, Supplier, Product, ToastMessage, User, StockMovement } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface PurchaseOrdersProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({
  addToast, showConfirmation, addActivityLog
}) => {
  const supabase = useSupabase();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // Estados para o Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<PurchaseOrder> | null>(null);

  const fetchData = useCallback(async () => {
    const [po, s, p] = await Promise.all([
        supabase.from('purchase_orders').select('*'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
    ]);
    if(po.data) setPurchaseOrders(po.data as unknown as PurchaseOrder[]);
    if(s.data) setSuppliers(s.data);
    if(p.data) setProducts(p.data);
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('purchase-orders-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [supabase, fetchData]);

  const addStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'date' | 'user_id'>) => {
    await supabase.from('stock_movements').insert({ ...movement, date: new Date().toISOString() });
  }, [supabase]);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...purchaseOrders].filter(o => o.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key;
        if (key === 'created_at') {
            return (new Date(a[key]).getTime() - new Date(b[key]).getTime()) * (sortConfig.direction === 'ascending' ? 1 : -1);
        }
        const valA = String(a[key] || '');
        const valB = String(b[key] || '');
        return valA.localeCompare(valB) * (sortConfig.direction === 'ascending' ? 1 : -1);
      });
    } else {
        sortableItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return sortableItems;
  }, [purchaseOrders, searchTerm, sortConfig]);

  // Filtro de produtos para a busca dentro do modal
  const filteredProductsSearch = useMemo(() => {
    if (!itemSearch.trim()) return [];
    return products.filter(p => 
        p.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
        p.id.toLowerCase().includes(itemSearch.toLowerCase())
    ).slice(0, 5); // Limita a 5 resultados para não poluir
  }, [products, itemSearch]);

  const openModal = (order: PurchaseOrder | null = null) => {
    setCurrentOrder(order ? { ...order } : { supplier_id: suppliers[0]?.id || '', items: [], status: 'pending' });
    setItemSearch('');
    setIsModalOpen(true);
  };

  const addItemToOrder = (product: Product) => {
      if (!currentOrder) return;
      const items = [...(currentOrder.items || [])];
      if (items.some(i => i.product_id === product.id)) {
          addToast("Este item já foi adicionado.", "warning");
          return;
      }
      items.push({ product_id: product.id, product_name: product.name, quantity: 1 });
      setCurrentOrder({ ...currentOrder, items });
      setItemSearch('');
  };

  const removeItemFromOrder = (productId: string) => {
      if (!currentOrder) return;
      const items = (currentOrder.items || []).filter(i => i.product_id !== productId);
      setCurrentOrder({ ...currentOrder, items });
  };

  const handleQtyChange = (productId: string, qty: number) => {
      if (!currentOrder) return;
      const items = (currentOrder.items || []).map(i => 
          i.product_id === productId ? { ...i, quantity: qty } : i
      );
      setCurrentOrder({ ...currentOrder, items });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentOrder || !currentOrder.supplier_id || !currentOrder.items || currentOrder.items.length === 0) {
        addToast("Fornecedor e pelo menos um item são obrigatórios.", 'error');
        return;
    }
    const supplier = suppliers.find(s => s.id === currentOrder.supplier_id);
    if (!supplier) return;
    
    const orderData = {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        status: currentOrder.status || 'pending',
        items: currentOrder.items as any,
        created_at: currentOrder.id ? currentOrder.created_at! : new Date().toISOString()
    };

    const { error } = currentOrder.id 
        ? await supabase.from('purchase_orders').update(orderData).eq('id', currentOrder.id)
        : await supabase.from('purchase_orders').insert(orderData);

    if (error) { 
        addToast(`Erro: ${error.message}`, 'error'); 
    } else {
        addToast(`Ordem de Compra ${currentOrder.id ? 'atualizada' : 'criada'}!`, 'success');
        addActivityLog(`${currentOrder.id ? 'atualizou' : 'criou'} OC para ${supplier.name}.`);
        setIsModalOpen(false);
        fetchData();
    }
  }

  const handleReceiveOrder = (order: PurchaseOrder) => {
    showConfirmation("Confirmar o recebimento desta ordem? Os itens serão adicionados ao saldo do estoque.", async () => {
        try {
            for (const item of order.items) {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                    await supabase.from('products').update({ quantity: product.quantity + item.quantity }).eq('id', item.product_id);
                    await addStockMovement({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        type: 'in',
                        quantity: item.quantity,
                        reason: `Recebimento OC #${order.id.substring(0, 8)}`,
                    });
                }
            }
            await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', order.id);
            addToast("Estoque atualizado com sucesso!", "success");
            fetchData();
        } catch (err) {
            addToast("Erro ao processar recebimento.", "error");
        }
    });
  }

  const columns = [
    { header: 'Fornecedor', accessor: 'supplier_name' as const, sortable: true },
    { header: 'Data', accessor: (item: PurchaseOrder) => new Date(item.created_at).toLocaleDateString('pt-BR'), sortable: true, sortKey: 'created_at' as const },
    { header: 'Itens', accessor: (item: PurchaseOrder) => `${item.items.length} tipo(s)` },
    { header: 'Status', accessor: (item: PurchaseOrder) => (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {item.status === 'received' ? 'RECEBIDO' : 'PENDENTE'}
        </span>
    ), sortable: true, sortKey: 'status' as const },
  ];

  // Fix: Correctly define the FractionButton parameters to avoid scope errors.
  const FractionButton = ({ label, value, onClick }: { label: string, value: number, onClick: (v: number) => void }) => (
    <button 
        type="button"
        onClick={() => onClick(value)}
        className="py-1 px-2 bg-gray-100 dark:bg-gray-700 hover:bg-primary hover:text-white rounded text-[10px] font-bold transition-all"
    >
        {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Ordens de Compra</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus pedidos de reposição com fornecedores.</p>
        </div>
        <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
          Nova Ordem de Compra
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por fornecedor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <Table<PurchaseOrder>
        columns={columns}
        data={sortedOrders}
        sortConfig={sortConfig}
        requestSort={(key) => {
            let direction: 'ascending' | 'descending' = 'ascending';
            if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
              direction = 'descending';
            }
            setSortConfig({ key, direction });
        }}
        actions={(order) => (
          <div className="flex space-x-2">
            {order.status === 'pending' && (
                <button onClick={() => handleReceiveOrder(order)} title="Marcar como Recebido" className="text-green-600 hover:bg-green-100 p-1.5 rounded-full transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </button>
            )}
            <button onClick={() => openModal(order)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button 
              onClick={() => showConfirmation("Deseja excluir esta Ordem de Compra?", async () => {
                const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id);
                if (error) addToast(`Erro ao excluir: ${error.message}`, 'error');
                else {
                    addToast("OC excluída!", "success");
                    fetchData();
                }
              })} 
              title="Excluir" 
              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
          </div>
        )}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentOrder?.id ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Fornecedor</label>
            <select 
              value={currentOrder?.supplier_id || ''} 
              onChange={e => setCurrentOrder(prev => prev ? ({ ...prev, supplier_id: e.target.value }) : null)} 
              className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              required
            >
                <option value="">Selecione um fornecedor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="border-t dark:border-gray-700 pt-4">
              <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Adicionar Itens</label>
              <div className="relative">
                  <input 
                      type="text" 
                      placeholder="Buscar produto por nome ou código..." 
                      value={itemSearch} 
                      onChange={e => setItemSearch(e.target.value)}
                      className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                  />
                  {filteredProductsSearch.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl">
                          {filteredProductsSearch.map(p => (
                              <button 
                                  key={p.id} 
                                  type="button"
                                  onClick={() => addItemToOrder(p)}
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm border-b last:border-0 dark:border-gray-700 flex justify-between items-center"
                              >
                                  <span>{p.name}</span>
                                  <span className="text-[10px] bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded uppercase">Cód: {p.id}</span>
                              </button>
                          ))}
                      </div>
                  )}
              </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 mt-4">
              {(currentOrder?.items as any[])?.map((item: any) => (
                  <div key={item.product_id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center justify-between">
                      <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.product_name}</p>
                          <p className="text-[10px] text-gray-500">ID: {item.product_id}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                          <div className="flex flex-col items-center">
                              <input 
                                  type="number" 
                                  value={item.quantity} 
                                  onChange={e => handleQtyChange(item.product_id, parseFloat(e.target.value))}
                                  className="w-16 p-1 text-center border rounded dark:bg-gray-800 dark:border-gray-600"
                              />
                              <div className="flex space-x-1 mt-1">
                                  <FractionButton label="+1" value={item.quantity + 1} onClick={(v) => handleQtyChange(item.product_id, v)} />
                                  <FractionButton label="+5" value={item.quantity + 5} onClick={(v) => handleQtyChange(item.product_id, v)} />
                              </div>
                          </div>
                          <button 
                              type="button" 
                              onClick={() => removeItemFromOrder(item.product_id)} 
                              className="text-red-500 hover:text-red-700"
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                      </div>
                  </div>
              ))}
              {(!currentOrder?.items || (currentOrder.items as any[]).length === 0) && (
                  <p className="text-center text-sm text-gray-500 italic py-4">Nenhum item adicionado à ordem.</p>
              )}
          </div>

          <div className="pt-4 flex flex-col space-y-2">
              <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-lg shadow-lg hover:bg-secondary transition">
                  {currentOrder?.id ? 'Atualizar Ordem' : 'Criar Ordem de Compra'}
              </button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition">Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
