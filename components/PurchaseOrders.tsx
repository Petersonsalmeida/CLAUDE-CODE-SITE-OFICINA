
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

  useEffect(() => {
    const fetchData = async () => {
        const [po, s, p] = await Promise.all([
            supabase.from('purchase_orders').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('products').select('*'),
        ]);
        if(po.data) setPurchaseOrders(po.data as unknown as PurchaseOrder[]);
        if(s.data) setSuppliers(s.data);
        if(p.data) setProducts(p.data);
    };
    fetchData();

    const channel = supabase.channel('purchase-orders-db-changes');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, payload => {
        if(payload.eventType === 'INSERT') {
            setPurchaseOrders(c => {
                if (c.some(item => item.id === payload.new.id)) return c;
                return [...c, payload.new as PurchaseOrder];
            });
        }
        if(payload.eventType === 'UPDATE') setPurchaseOrders(c => c.map(i => i.id === payload.new.id ? payload.new as PurchaseOrder : i));
        if(payload.eventType === 'DELETE') setPurchaseOrders(c => c.filter(i => i.id !== (payload.old as PurchaseOrder).id));
    }).subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, [supabase]);

  const addStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'date' | 'user_id'>) => {
    const { error } = await supabase.from('stock_movements').insert({ ...movement, date: new Date().toISOString() }).select().single();
    if(error) {
        addToast(`Erro ao registrar movimento: ${error.message}`, 'error');
    }
  }, [addToast, supabase]);


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Partial<PurchaseOrder> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<PurchaseOrder> | null>(null);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...purchaseOrders].filter(o => o.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const key = sortConfig.key;
        if (key === 'created_at') {
            const dateA = new Date(a[key]).getTime();
            const dateB = new Date(b[key]).getTime();
            if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }
        const valA = a[key] || '';
        const valB = b[key] || '';
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
      return sortableItems;
    }
    return sortableItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [purchaseOrders, searchTerm, sortConfig]);
  
  const openModal = (order: PurchaseOrder | null = null) => {
    setCurrentOrder(order ? { ...order } : { supplier_id: suppliers[0]?.id || '', items: [], status: 'pending' });
    setIsModalOpen(true);
  };
  
  const handleItemChange = (productId: string, quantity: string) => {
    const qty = Number(quantity);
    if (!currentOrder) return;
    
    let items = [...(currentOrder.items || [])];
    const existingItem = items.find(i => i.product_id === productId);

    if (qty > 0) {
      if (existingItem) {
        existingItem.quantity = qty;
      } else {
        const product = products.find(p => p.id === productId);
        if (product) items.push({ product_id: productId, product_name: product.name, quantity: qty });
      }
    } else {
      items = items.filter(i => i.product_id !== productId);
    }
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

    if (currentOrder.id) {
        const originalOrders = purchaseOrders;
        setPurchaseOrders(prev => prev.map(o => o.id === currentOrder.id ? {...o, ...orderData} as PurchaseOrder : o));
        const { error } = await supabase.from('purchase_orders').update(orderData).eq('id', currentOrder.id);
        if (error) { 
            addToast(`Erro: ${error.message}`, 'error'); 
            setPurchaseOrders(originalOrders); // Revert
        } else {
            addToast(`Ordem de Compra atualizada!`, 'success');
            addActivityLog(`atualizou Ordem de Compra ${currentOrder.id} para ${supplier.name}.`);
        }
    } else {
        const { data, error } = await supabase.from('purchase_orders').insert(orderData).select().single();
        if (error) { 
            addToast(`Erro: ${error.message}`, 'error'); 
        } else if (data) {
            setPurchaseOrders(prev => [...prev, data as unknown as PurchaseOrder]); // Manual update
            addToast(`Ordem de Compra criada!`, 'success');
            addActivityLog(`criou Ordem de Compra para ${supplier.name}.`);
        }
    }
    
    setIsModalOpen(false);
  }

  const handleReceiveOrder = (order: PurchaseOrder) => {
    showConfirmation("Marcar esta ordem como recebida? Isso adicionará os itens ao estoque.", async () => {
        const originalProducts = products;
        const originalOrders = purchaseOrders;

        // Optimistic UI updates
        const updatedProductQuantities: { [key: string]: number } = {};
        order.items.forEach(item => {
            const product = products.find(p => p.id === item.product_id);
            if(product) {
                updatedProductQuantities[item.product_id] = product.quantity + item.quantity;
            }
        });

        setProducts(prev => prev.map(p => updatedProductQuantities[p.id] ? {...p, quantity: updatedProductQuantities[p.id]} : p));
        setPurchaseOrders(prev => prev.map(o => o.id === order.id ? {...o, status: 'received'} : o));
        
        // DB updates
        const productUpdates = Object.keys(updatedProductQuantities).map(productId => 
            supabase.from('products').update({ quantity: updatedProductQuantities[productId] }).eq('id', productId)
        );
        const orderUpdate = supabase.from('purchase_orders').update({ status: 'received' }).eq('id', order.id);

        const results = await Promise.all([...productUpdates, orderUpdate]);
        const dbError = results.some((res: { error: unknown }) => res.error);

        if (dbError) {
            addToast("Erro ao receber ordem. Desfazendo alterações.", 'error');
            setProducts(originalProducts); // Revert
            setPurchaseOrders(originalOrders);
        } else {
            for (const item of order.items) {
                await addStockMovement({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    type: 'in',
                    quantity: item.quantity,
                    reason: `Recebimento OC #${order.id.substring(0, 8)}`,
                });
            }
            addToast("Ordem recebida e estoque atualizado!", "success");
            addActivityLog(`recebeu a Ordem de Compra de ${order.supplier_name}.`);
        }
    });
  }
  
  const handleDeleteOrder = (order: PurchaseOrder) => {
    showConfirmation(`Tem certeza que deseja excluir a ordem de compra de ${order.supplier_name}?`, async () => {
        const originalOrders = purchaseOrders;
        // Optimistic update
        setPurchaseOrders(prev => prev.filter(o => o.id !== order.id));

        const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id);

        if (error) {
            addToast(`Erro ao excluir: ${error.message}`, 'error');
            setPurchaseOrders(originalOrders); // Revert
        } else {
            addToast('Ordem de compra excluída com sucesso!', 'success');
            addActivityLog(`excluiu a Ordem de Compra de ${order.supplier_name}.`);
        }
    });
  };

  const columns = [
    { header: 'Fornecedor', accessor: 'supplier_name' as const, sortable: true },
    { header: 'Data', accessor: (item: PurchaseOrder) => new Date(item.created_at).toLocaleDateString('pt-BR'), sortable: true, sortKey: 'created_at' as const },
    { header: 'Itens', accessor: (item: PurchaseOrder) => item.items.length },
    { header: 'Status', accessor: 'status' as const, sortable: true },
  ];

  const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Ordens de Compra</h2>
          <p className="text-gray-500 dark:text-gray-400">Crie e gerencie seus pedidos para fornecedores.</p>
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
              const message = encodeURIComponent(`Olá, gostaria de fazer um pedido:\nFornecedor: ${order.supplier_name}\n\nItens:\n${order.items.map(i => `- ${i.quantity}x ${i.product_name}`).join('\n')}`);
              const whatsappUrl = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${message}` : '';

              return (
              <div className="flex space-x-2">
                  <button onClick={() => openModal(order)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                  </button>
                  {order.status === 'pending' && (
                      <button onClick={() => handleReceiveOrder(order)} title="Receber Pedido" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </button>
                  )}
                  {whatsappUrl ? (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar via WhatsApp"
                        className="text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                           <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                         </svg>
                      </a>
                  ) : (
                      <button onClick={() => addToast('Fornecedor sem WhatsApp cadastrado.', 'info')} title="WhatsApp não disponível" className="text-gray-400 cursor-not-allowed">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                          </svg>
                      </button>
                  )}
                  <button onClick={() => handleDeleteOrder(order)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
              </div>
              );
          }}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentOrder?.id ? 'Editar Ordem' : 'Nova Ordem'}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fornecedor</label>
                <select 
                    id="supplier" 
                    value={currentOrder?.supplier_id} 
                    onChange={e => setCurrentOrder(prev => ({...prev, supplier_id: e.target.value}))} 
                    className={formInputClass}
                    disabled={!!currentOrder?.id}
                >
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Itens do Pedido</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {products.map(product => {
                        const item = currentOrder?.items?.find(i => i.product_id === product.id);
                        const quantity = item ? item.quantity : 0;
                        return (
                            <div key={product.id} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded shadow-sm">
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{product.name}</p>
                                    <p className="text-xs text-gray-500">Atual: {product.quantity}</p>
                                </div>
                                <input 
                                    type="number" 
                                    min="0" 
                                    value={quantity} 
                                    onChange={(e) => handleItemChange(product.id, e.target.value)}
                                    className="w-20 p-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
