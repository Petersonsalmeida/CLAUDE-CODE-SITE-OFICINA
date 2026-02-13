import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { CarPart, Employee, StockMovement, ToastMessage, User, WorkOrder } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { CameraModal } from './shared/CameraModal';
import { useSupabase } from '../contexts/SupabaseContext';

interface CarPartsProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const CarParts: React.FC<CarPartsProps> = ({ 
    addToast, showConfirmation, addActivityLog
}) => {
  const supabase = useSupabase();
  const [carParts, setCarParts] = useState<CarPart[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const { data: partsData, error: partsError } = await supabase.from('car_parts').select('*');
        if (partsError) addToast('Erro ao carregar peças', 'error'); else if(partsData) setCarParts(partsData);

        const { data: empData, error: empError } = await supabase.from('employees').select('*');
        if (empError) addToast('Erro ao carregar funcionários', 'error'); else if(empData) setEmployees(empData);

        const { data: woData, error: woError } = await supabase.from('work_orders').select('*');
        if (woError) addToast('Erro ao carregar OS', 'error'); else if(woData) setWorkOrders(woData as unknown as WorkOrder[]);
    };
    fetchData();

    const channel = supabase.channel('car-parts-db-changes');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'car_parts' }, (payload) => {
        if(payload.eventType === 'INSERT') {
            setCarParts(c => {
                if (c.some(item => item.id === payload.new.id)) return c;
                return [...c, payload.new as CarPart];
            });
        }
        if(payload.eventType === 'UPDATE') setCarParts(c => c.map(p => p.id === payload.new.id ? payload.new as CarPart : p));
        if(payload.eventType === 'DELETE') setCarParts(c => c.filter(p => p.id !== (payload.old as CarPart).id));
    }).subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, [supabase, addToast]);
  
  const addStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'date' | 'user_id'>) => {
    const { error } = await supabase.from('stock_movements').insert({ ...movement, date: new Date().toISOString() }).select().single();
    if(error) {
        addToast(`Erro ao registrar movimento: ${error.message}`, 'error');
    }
  }, [addToast, supabase]);


  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  
  const [currentPart, setCurrentPart] = useState<Partial<CarPart> | null>(null);
  const [stockAction, setStockAction] = useState<'in' | 'out'>('in');
  const [stockQuantity, setStockQuantity] = useState<number | string>(1);
  const [stockEmployeeId, setStockEmployeeId] = useState<string>('');
  const [stockWorkOrderId, setStockWorkOrderId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<CarPart> | null>(null);

  const filteredParts = useMemo(() => {
    return carParts.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.id && p.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.vehicle_model && p.vehicle_model.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [carParts, searchTerm]);
  
  const requestSort = (key: keyof CarPart) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedParts = useMemo(() => {
      let sortableItems = [...filteredParts];
      if (sortConfig !== null) {
          sortableItems.sort((a, b) => {
              const valA = a[sortConfig.key];
              const valB = b[sortConfig.key];
               if (typeof valA === 'number' && typeof valB === 'number') {
                  if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                  if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                  return 0;
              }
              const strA = String(valA).toLowerCase();
              const strB = String(valB).toLowerCase();
              if (strA < strB) return sortConfig.direction === 'ascending' ? -1 : 1;
              if (strA > strB) return sortConfig.direction === 'ascending' ? 1 : -1;
              return 0;
          });
      }
      return sortableItems;
  }, [filteredParts, sortConfig]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentPart(prev => prev ? ({ ...prev, photo: reader.result as string }) : null);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleCameraCapture = (imageData: string) => {
      setCurrentPart(prev => prev ? ({ ...prev, photo: imageData }) : null);
      setIsCameraModalOpen(false);
  };

  const handlePartSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const partId = currentPart?.id ? currentPart.id : (formData.get('id') as string);

    if (!currentPart?.id && carParts.some(p => p.id === partId)) {
        addToast('Erro: Já existe uma peça com este código/ID.', 'error');
        return;
    }
    
    const partData = {
        id: partId,
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        vehicle_model: formData.get('vehicleModel') as string,
        quantity: parseFloat(formData.get('quantity') as string) || 0,
        location: formData.get('location') as string,
        unit_price: parseFloat(formData.get('unitPrice') as string) || 0,
        photo: currentPart?.photo || undefined,
    };

    if (currentPart?.id) { // Editing
        const originalParts = carParts;
        setCarParts(prev => prev.map(p => p.id === currentPart!.id ? { ...p, ...partData } : p));
        const { error } = await supabase.from('car_parts').update(partData).eq('id', currentPart.id);
        if(error) {
            addToast(`Erro ao atualizar peça: ${error.message}`, 'error');
            setCarParts(originalParts); // Revert
        } else {
            addToast('Peça atualizada com sucesso!', 'success');
            addActivityLog(`atualizou a peça: ${partData.name}`);
        }
    } else { // Adding
        const { data, error } = await supabase.from('car_parts').insert(partData).select().single();
        if (error) {
            addToast(`Erro ao cadastrar peça: ${error.message}`, 'error');
        } else if (data) {
            setCarParts(prev => [...prev, data]); // Manual update
            await addStockMovement({
                product_id: partData.id,
                product_name: partData.name,
                type: 'in',
                quantity: partData.quantity,
                reason: 'Cadastro de Peça Nova',
            });
            addToast('Peça cadastrada com sucesso!', 'success');
            addActivityLog(`cadastrou a peça: ${partData.name}`);
        }
    }

    closePartModal();
  };

  const handleDeletePart = (part: CarPart) => {
    showConfirmation('Tem certeza que deseja excluir esta peça?', async () => {
        const originalParts = carParts;
        setCarParts(prev => prev.filter(p => p.id !== part.id));
        const { error } = await supabase.from('car_parts').delete().eq('id', part.id);
        if(error) {
            addToast(`Erro ao excluir: ${error.message}`, 'error');
            setCarParts(originalParts); // Revert
        } else {
            addToast('Peça excluída com sucesso!', 'success');
            addActivityLog(`excluiu a peça: ${part.name}`);
        }
    });
  }

  const openPartModal = (part: CarPart | null) => {
    setCurrentPart(part ? {...part} : { id: '', name: '', quantity: 0, location: '', unit_price: 0 });
    setIsPartModalOpen(true);
  };

  const closePartModal = () => {
    setCurrentPart(null);
    setIsPartModalOpen(false);
  };
  
  const openStockModal = (part: CarPart, action: 'in' | 'out') => {
      setCurrentPart(part);
      setStockAction(action);
      setStockQuantity(1);
      setStockEmployeeId(employees.length > 0 ? employees[0].id : '');
      setStockWorkOrderId(''); // Default to "None"
      setIsStockModalOpen(true);
  }
  
  const closeStockModal = () => {
      setIsStockModalOpen(false);
      setCurrentPart(null);
  }

  const handleStockAction = async () => {
      if (!currentPart || !currentPart.id) return;
      const quantity = Number(stockQuantity);
      
      if (stockAction === 'out' && (!stockEmployeeId || quantity > currentPart.quantity!)) {
          addToast("Dados de saída inválidos. Verifique funcionário e quantidade.", 'error');
          return;
      }

      const quantityChange = stockAction === 'in' ? quantity : -quantity;
      const newQuantity = currentPart.quantity! + quantityChange;

      const originalPart = carParts.find(p => p.id === currentPart.id);
      setCarParts(prev => prev.map(p => p.id === currentPart!.id ? {...p, quantity: newQuantity} : p));
      
      const { error } = await supabase.from('car_parts').update({ quantity: newQuantity }).eq('id', currentPart.id);

      if (error) {
          addToast(`Erro ao atualizar estoque da peça: ${error.message}`, 'error');
          if (originalPart) setCarParts(prev => prev.map(p => p.id === originalPart.id ? originalPart : p)); // Revert
          return;
      }
      
      const employee = employees.find(e => e.id === stockEmployeeId);
      const workOrder = workOrders.find(wo => wo.id === stockWorkOrderId);
      
      const reason = stockAction === 'in' 
          ? 'Entrada manual de peça'
          : (workOrder 
              ? `para OS "${workOrder.title}" por ${employee?.name}`
              : `Uso geral por ${employee?.name}`);

      await addStockMovement({
        product_id: currentPart.id,
        product_name: currentPart.name!,
        type: stockAction,
        quantity: quantity,
        reason: reason,
        employee_id: stockEmployeeId,
        employee_name: employee?.name,
        work_order_id: stockWorkOrderId || undefined
      });

      addToast(`Movimentação de estoque (${stockAction}) registrada!`, 'success');
      addActivityLog(`registrou ${stockAction === 'in' ? 'entrada' : 'saída'} de ${quantity}x da peça ${currentPart.name}`);
      closeStockModal();
  }

  const columns = [
    { header: 'Foto', accessor: (item: CarPart) => (
        item.photo ? <img src={item.photo} alt={item.name} className="w-16 h-16 object-cover rounded-md" /> : <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-xs text-gray-500">Sem foto</div>
    )},
    { header: 'Código/ID', accessor: 'id' as const, sortable: true },
    { header: 'Nome', accessor: 'name' as const, sortable: true },
    { header: 'Modelo Aplicável', accessor: 'vehicle_model' as const, sortable: true },
    { header: 'Quantidade', accessor: 'quantity' as const, sortable: true },
    { header: 'Localização', accessor: 'location' as const, sortable: true },
  ];
  
  const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-50 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

  return (
    <div className="space-y-6">
      <div className="sm:flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Estoque de Peças Automotivas</h2>
            <p className="text-gray-500 dark:text-gray-400">Gerencie o inventário de peças para veículos.</p>
        </div>
        <button onClick={() => openPartModal(null)} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition mt-4 sm:mt-0">
            Nova Peça
        </button>
      </div>
      
       <div className="relative">
          <input
              type="text"
              placeholder="Buscar por código, nome ou modelo do veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
      </div>
      
      <Table<CarPart>
        columns={columns}
        data={sortedParts}
        actions={(part) => (
          <>
            <button onClick={() => openStockModal(part, 'in')} title="Entrada de Estoque" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                </svg>
            </button>
            <button onClick={() => openStockModal(part, 'out')} title="Saída de Estoque" className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
            <button onClick={() => openPartModal(part)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button onClick={() => handleDeletePart(part)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
          </>
        )}
        sortConfig={sortConfig}
        requestSort={requestSort}
      />

      <Modal isOpen={isPartModalOpen} onClose={closePartModal} title={currentPart?.id ? 'Editar Peça' : 'Nova Peça'}>
        <form onSubmit={handlePartSubmit} className="space-y-4">
            <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código/ID da Peça</label>
                <input type="text" name="id" id="id" defaultValue={currentPart?.id} required className={formInputClass} disabled={!!currentPart?.id}/>
            </div>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Peça</label>
                <input type="text" name="name" id="name" defaultValue={currentPart?.name} required className={formInputClass}/>
            </div>
             <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                <textarea name="description" id="description" defaultValue={currentPart?.description || ''} className={formInputClass}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
                    <input type="number" step="1" name="quantity" id="quantity" defaultValue={currentPart?.quantity} required className={formInputClass}/>
                </div>
                <div>
                    <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preço Unitário (R$)</label>
                    <input type="number" step="0.01" name="unitPrice" id="unitPrice" defaultValue={currentPart?.unit_price} required className={formInputClass}/>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="vehicleModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Modelo do Veículo</label>
                    <input type="text" name="vehicleModel" id="vehicleModel" defaultValue={currentPart?.vehicle_model || ''} className={formInputClass}/>
                </div>
                 <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Localização</label>
                    <input type="text" name="location" id="location" defaultValue={currentPart?.location || ''} className={formInputClass}/>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto</label>
                <div className="mt-1 flex items-center space-x-4">
                    {currentPart?.photo && <img src={currentPart.photo} alt="Preview" className="w-20 h-20 object-cover rounded-md" />}
                     <div className="flex items-center space-x-2">
                         <input type="file" id="part-photo-upload" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
                         <label htmlFor="part-photo-upload" className="cursor-pointer bg-white dark:bg-gray-700 text-sm text-primary dark:text-accent font-semibold py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                           Escolher Ficheiro
                         </label>
                         <button type="button" onClick={() => setIsCameraModalOpen(true)} className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H12a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M15 9a3 3 0 10-6 0 3 3 0 006 0z" /></svg>
                         </button>
                     </div>
                 </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closePartModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar Peça</button>
            </div>
        </form>
      </Modal>
      
      <Modal isOpen={isStockModalOpen} onClose={closeStockModal} title={`Movimentar Estoque: ${currentPart?.name}`}>
        <div className="space-y-4">
            <p><strong>Estoque atual:</strong> {currentPart?.quantity}</p>
             <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
              <input type="number" id="quantity" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} min="0.01" step="0.01" max={stockAction === 'out' ? currentPart?.quantity : undefined} className={formInputClass} />
            </div>
             {stockAction === 'out' && (
                <>
                <div>
                    <label htmlFor="employee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Funcionário</label>
                    <select id="employee" value={stockEmployeeId} onChange={e => setStockEmployeeId(e.target.value)} className={formInputClass} required>
                      <option value="" disabled>Selecione um funcionário</option>
                      {employees.map(employee => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </select>
                </div>
                 <div>
                  <label htmlFor="workorder" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ordem de Serviço (Opcional)</label>
                  <select id="workorder" value={stockWorkOrderId} onChange={(e) => setStockWorkOrderId(e.target.value)} className={formInputClass}>
                      <option value="">Nenhuma / Uso Geral</option>
                      {workOrders.filter(wo => wo.status !== 'completed').map(wo => (
                          <option key={wo.id} value={wo.id}>{wo.title}</option>
                      ))}
                  </select>
                </div>
                </>
             )}
            <button onClick={handleStockAction} className={`${stockAction === 'in' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white px-4 py-2 rounded w-full`}>
                Confirmar {stockAction === 'in' ? 'Entrada' : 'Saída'}
            </button>
        </div>
      </Modal>

      <CameraModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={handleCameraCapture} />

    </div>
  );
};