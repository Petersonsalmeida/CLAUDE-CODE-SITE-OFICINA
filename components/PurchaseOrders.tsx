
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
            return new Date(a[key]).getTime() - new Date(b[key]).getTime() * (sortConfig.direction === 'ascending' ? 1 : -1);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Ordens de Compra</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus pedidos e recebimentos.</p>
        </div>
        <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
          Nova Ordem
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

      <Table
          columns={columns}
          data={sortedOrders}
          sortConfig={sortConfig}
          requestSort={(key) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
          actions={(order) => {
              const supplier = suppliers.find(s => s.id === order.supplier_id);
              const whatsappNumber = supplier?.whatsapp?.replace(/\D/g, '');
              const message = encodeURIComponent(`Olá, gostaria de confirmar o pedido:\nFornecedor: ${order.supplier_name}\n\nItens:\n${order.items.map(i => `- ${i.quantity}x ${i.product_name}`).join('\n')}`);
              
              return (
              <div className="flex space-x-2">
                  {order.status === 'pending' && (
                      <>
                        <button onClick={() => openModal(order)} title="Editar" className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-md transition"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                        <button onClick={() => handleReceiveOrder(order)} title="Receber Pedido" className="text-green-600 hover:bg-green-100 p-1.5 rounded-md transition"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></button>
                      </>
                  )}
                  {whatsappNumber && (
                      <a href={`https://wa.me/${whatsappNumber}?text=${message}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:bg-green-50 p-1.5 rounded-md transition"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>
                  )}
              </div>
              );
          }}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentOrder?.id ? 'Editar Ordem' : 'Nova Ordem de Compra'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Fornecedor Destino</label>
                <select 
                    value={currentOrder?.supplier_id} 
                    onChange={e => setCurrentOrder(prev => ({...prev, supplier_id: e.target.value}))} 
                    className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                    disabled={!!currentOrder?.id}
                >
                    <option value="">Selecione um fornecedor...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            
            <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Adicionar Itens ao Pedido</label>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Pesquisar produto por nome ou código..."
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        className="w-full p-3 pl-10 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    
                    {/* Resultados da busca rápida */}
                    {filteredProductsSearch.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                            {filteredProductsSearch.map(p => (
                                <button 
                                    key={p.id} 
                                    type="button"
                                    onClick={() => addItemToOrder(p)}
                                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-0 dark:border-gray-700 flex justify-between items-center"
                                >
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{p.name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Cód: {p.id} | Saldo: {p.quantity}</p>
                                    </div>
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-800">
                <h4 className="text-sm font-bold mb-4 text-gray-700 dark:text-gray-300 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    Lista de Compra ({currentOrder?.items?.length || 0})
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
                    {currentOrder?.items && currentOrder.items.length > 0 ? currentOrder.items.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-fade-in">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate pr-2 uppercase">{item.product_name}</p>
                                <p className="text-[10px] text-gray-500 font-mono">{item.product_id}</p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="flex flex-col items-center">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase">Qtd</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={item.quantity} 
                                        onChange={(e) => handleQtyChange(item.product_id, Number(e.target.value))}
                                        className="w-16 p-1 text-center font-bold border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => removeItemFromOrder(item.product_id)}
                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10">
                            <p className="text-sm text-gray-500 italic">Pesquise e selecione os itens acima para montar sua ordem.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col pt-4">
                <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-secondary transition-all">
                    {currentOrder?.id ? 'Atualizar Ordem de Compra' : 'Confirmar e Gerar Ordem'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="mt-2 py-2 text-sm text-gray-500 hover:text-red-500 transition">Cancelar</button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
