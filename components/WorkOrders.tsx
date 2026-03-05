
import React, { useState, useMemo, FormEvent, useEffect } from 'react';
import { WorkOrder, ToastMessage, User, StockMovement, Product, CarPart } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface WorkOrdersProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const WorkOrders: React.FC<WorkOrdersProps> = ({
  addToast, showConfirmation, addActivityLog, currentUser
}) => {
  const supabase = useSupabase();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [carParts, setCarParts] = useState<CarPart[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
        const [wo, sm, p, cp] = await Promise.all([
            supabase.from('work_orders').select('*'),
            supabase.from('stock_movements').select('*'),
            supabase.from('products').select('*'),
            supabase.from('car_parts').select('*'),
        ]);
        if(wo.data) setWorkOrders(wo.data as unknown as WorkOrder[]);
        if(sm.data) setStockMovements(sm.data as unknown as StockMovement[]);
        if(p.data) setProducts(p.data);
        if(cp.data) setCarParts(cp.data);
    };
    fetchData();

    const channel = supabase.channel('work-orders-db-changes');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, (payload) => {
        if(payload.eventType === 'INSERT') {
            setWorkOrders(c => {
                if (c.some(item => item.id === payload.new.id)) return c;
                return [...c, payload.new as WorkOrder];
            });
        }
        if(payload.eventType === 'UPDATE') setWorkOrders(c => c.map(i => i.id === payload.new.id ? payload.new as WorkOrder : i));
        if(payload.eventType === 'DELETE') setWorkOrders(c => c.filter(i => i.id !== (payload.old as WorkOrder).id));
    }).on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, (payload) => {
        // Keep stock movements fresh for cost calculation
        if(payload.eventType === 'INSERT') setStockMovements(c => [...c, payload.new as StockMovement]);
        if(payload.eventType === 'UPDATE') setStockMovements(c => c.map(i => i.id === payload.new.id ? payload.new as StockMovement : i));
        if(payload.eventType === 'DELETE') setStockMovements(c => c.filter(i => i.id !== (payload.old as StockMovement).id));
    }).subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, [supabase]);


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<WorkOrder> | null>(null);

  const filteredOrders = useMemo(() => {
    return workOrders.filter(o =>
      o.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [workOrders, searchTerm]);

  const requestSort = (key: keyof WorkOrder) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
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
    return sortableItems.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredOrders, sortConfig]);

  const openModal = (order: WorkOrder | null = null) => {
    setCurrentOrder(order);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setCurrentOrder(null);
    setIsModalOpen(false);
  };
  
  const openDetailsModal = (order: WorkOrder) => {
      setCurrentOrder(order);
      setIsDetailsModalOpen(true);
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const orderData = {
      title: formData.get('title') as string,
      status: formData.get('status') as 'open' | 'in_progress' | 'completed',
      items: (currentOrder?.items || []) as any
    };

    if (currentOrder?.id) {
      const { error } = await supabase.from('work_orders').update(orderData).eq('id', currentOrder.id);
      if (error) {
        addToast(`Erro ao atualizar: ${error.message}`, 'error');
      } else {
        addToast('Ordem de Serviço atualizada!', 'success');
        addActivityLog(`atualizou a OS: ${orderData.title}.`);
      }
    } else {
      const { data, error } = await supabase.from('work_orders').insert(orderData).select().single();
       if (error) {
        addToast(`Erro ao criar: ${error.message}`, 'error');
      } else if (data) {
        setWorkOrders(prev => [...prev, data as unknown as WorkOrder]); // Manual update
        addToast('Ordem de Serviço criada!', 'success');
        addActivityLog(`criou a OS: ${orderData.title}.`);
      }
    }
    closeModal();
  };

  const handleDelete = (id: string, title: string) => {
    showConfirmation('Tem certeza que deseja excluir esta Ordem de Serviço?', async () => {
      const originalOrders = workOrders;
      setWorkOrders(prev => prev.filter(o => o.id !== id));
      const { error } = await supabase.from('work_orders').delete().eq('id', id);
      if (error) {
        addToast(`Erro ao excluir: ${error.message}`, 'error');
        setWorkOrders(originalOrders);
      } else {
        addToast('Ordem de Serviço excluída!', 'success');
        addActivityLog(`excluiu a OS: ${title}.`);
      }
    });
  };

  const getWorkOrderCost = (orderId: string) => {
     const movementsForOrder = stockMovements.filter(m => m.work_order_id === orderId && m.type === 'out');
     return movementsForOrder.reduce((total, movement) => {
         const product = products.find(p => p.id === movement.product_id);
         const carPart = carParts.find(p => p.id === movement.product_id);
         const price = product?.unit_price || carPart?.unit_price || 0;
         return total + ((Number(movement.quantity) || 0) * (Number(price) || 0));
     }, 0);
  }

  const columns = [
    { header: 'Título', accessor: 'title' as const, sortable: true },
    { header: 'Status', accessor: 'status' as const, sortable: true },
    { header: 'Data de Criação', accessor: (item: WorkOrder) => new Date(item.created_at).toLocaleDateString('pt-BR'), sortable: true, sortKey: 'created_at' as const},
    { header: 'Custo de Materiais', accessor: (item: WorkOrder) => getWorkOrderCost(item.id).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}), sortable: false },
  ];
  
  const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Ordens de Serviço</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus trabalhos e controle os custos.</p>
        </div>
        <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
          Nova OS
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por título..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <Table<WorkOrder>
        columns={columns}
        data={sortedOrders}
        actions={(order) => (
          <>
            <button onClick={() => openDetailsModal(order)} title="Detalhes" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </button>
            <button onClick={() => openModal(order)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button onClick={() => handleDelete(order.id, order.title)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
          </>
        )}
        sortConfig={sortConfig}
        requestSort={requestSort}
      />

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentOrder?.id ? 'Editar OS' : 'Nova OS'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
            <input type="text" name="title" id="title" defaultValue={currentOrder?.title} required className={formInputClass}/>
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <select name="status" id="status" defaultValue={currentOrder?.status || 'open'} className={formInputClass}>
              <option value="open">Aberta</option>
              <option value="in_progress">Em Progresso</option>
              <option value="completed">Concluída</option>
            </select>
          </div>
          <div className="flex justify-end pt-4 space-x-2">
            <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title={`Detalhes da OS: ${currentOrder?.title}`}>
        {currentOrder && (
            <div className="space-y-4">
                <p><strong>Status:</strong> {currentOrder.status}</p>
                <p><strong>Custo Total de Materiais:</strong> {getWorkOrderCost(currentOrder.id).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                <h4 className="font-semibold pt-4 border-t dark:border-gray-700">Materiais Utilizados</h4>
                <div className="max-h-60 overflow-y-auto">
                    <ul>
                        {stockMovements.filter(m => m.work_order_id === currentOrder.id).map(m => (
                            <li key={m.id} className="text-sm py-1">{m.quantity}x {m.product_name}</li>
                        ))}
                    </ul>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
