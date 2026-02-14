
import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { Product, Employee, StockMovement, ToastMessage, User, WorkOrder } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';
import { QRCodeModal } from './shared/QRCodeModal';
import { QRCodeScannerModal } from './shared/QRCodeScannerModal';
import { parseNFeXML } from '../services/nfeParser';

interface StockControlProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

/**
 * Component for managing general inventory products.
 * Includes features for adding, editing, deleting, and moving stock (in/out).
 * Supports QR code generation/scanning and NFe XML import.
 */
export const StockControl: React.FC<StockControlProps> = ({ 
    addToast, showConfirmation, addActivityLog
}) => {
  const supabase = useSupabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  // Memoized fetch function to keep data synchronized
  const fetchData = useCallback(async () => {
    const [p, e, wo] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('work_orders').select('*'),
    ]);
    if (p.data) setProducts(p.data);
    if (e.data) setEmployees(e.data);
    if (wo.data) setWorkOrders(wo.data as unknown as WorkOrder[]);
  }, [supabase]);

  // Initial fetch and setup realtime subscription
  useEffect(() => {
    fetchData();
    const channel = supabase.channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockAction, setStockAction] = useState<'in' | 'out'>('in');
  const [stockQuantity, setStockQuantity] = useState<number | string>(1);
  const [stockEmployeeId, setStockEmployeeId] = useState<string>('');
  const [stockWorkOrderId, setStockWorkOrderId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<Product>>(null);

  // Search filter
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // Sort logic
  const requestSort = (key: keyof Product) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedProducts = useMemo(() => {
    let sortableItems = [...filteredProducts];
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
  }, [filteredProducts, sortConfig]);

  // Handle Create/Update
  const handleProductSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const name = formData.get('name') as string;
    const unit_price = parseFloat(formData.get('unitPrice') as string);
    const quantity = parseFloat(formData.get('quantity') as string);
    const min_stock = parseFloat(formData.get('minStock') as string);

    if (currentProduct?.id) {
      const { error } = await supabase.from('products').update({
        name,
        unit_price,
        quantity,
        min_stock
      }).eq('id', currentProduct.id);

      if (error) addToast(`Erro ao atualizar: ${error.message}`, 'error');
      else {
        addToast('Produto atualizado!', 'success');
        addActivityLog(`atualizou o produto ${name}`);
        await fetchData();
        setIsProductModalOpen(false);
      }
    } else {
      const id = formData.get('id') as string;
      const { error } = await supabase.from('products').insert({
        id,
        name,
        unit_price,
        quantity,
        min_stock
      });

      if (error) addToast(`Erro ao cadastrar: ${error.message}`, 'error');
      else {
        addToast('Produto cadastrado!', 'success');
        addActivityLog(`cadastrou o produto ${name}`);
        await fetchData();
        setIsProductModalOpen(false);
      }
    }
  };

  // Handle Stock Movement
  const handleStockAction = async () => {
    if (!currentProduct) return;
    const qty = parseFloat(stockQuantity as string);
    const newQty = stockAction === 'in' ? currentProduct.quantity + qty : currentProduct.quantity - qty;

    if (newQty < 0) {
      addToast('Erro: Estoque insuficiente.', 'error');
      return;
    }

    const { error } = await supabase.from('products').update({ quantity: newQty }).eq('id', currentProduct.id);
    if (error) {
      addToast(`Erro ao movimentar: ${error.message}`, 'error');
      return;
    }

    const employee = employees.find(e => e.id === stockEmployeeId);
    const movement = {
      product_id: currentProduct.id,
      product_name: currentProduct.name,
      type: stockAction,
      quantity: qty,
      date: new Date().toISOString(),
      employee_id: stockEmployeeId || null,
      employee_name: employee?.name || null,
      work_order_id: stockWorkOrderId || null,
      reason: stockAction === 'in' ? 'Entrada manual' : 'Saída manual',
    };

    await supabase.from('stock_movements').insert(movement);
    addToast('Estoque atualizado!', 'success');
    addActivityLog(`${stockAction === 'in' ? 'entrada' : 'saída'} de ${qty}x ${currentProduct.name}`);
    await fetchData();
    setIsStockModalOpen(false);
  };

  // Handle Delete
  const handleDelete = (product: Product) => {
    showConfirmation(`Deseja excluir o produto ${product.name}?`, async () => {
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) addToast(`Erro ao excluir: ${error.message}`, 'error');
      else {
        addToast('Produto excluído!', 'success');
        addActivityLog(`excluiu o produto ${product.name}`);
        await fetchData();
      }
    });
  };

  // Handle NFe XML Import
  const handleImportXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const xml = event.target?.result as string;
        const parsed = await parseNFeXML(xml);
        
        // CORREÇÃO: Verificação de duplicidade procurando no campo JSONB do fornecedor
        const { data: existingNfs } = await supabase
            .from('nfs')
            .select('supplier')
            .contains('supplier', { access_key: parsed.access_key });

        if (existingNfs && existingNfs.length > 0) {
            addToast(`Esta Nota Fiscal (Chave: ...${parsed.access_key.slice(-10)}) já foi importada anteriormente.`, 'error');
            return;
        }
        
        showConfirmation(`Deseja importar ${parsed.products.length} produtos da NF de ${parsed.supplier.name}?`, async () => {
            // CORREÇÃO: Inserir sem passar 'id' explicitamente (evita erro UUID) 
            // e incluir access_key no JSON do fornecedor para controle futuro
            const { error: nfError } = await supabase.from('nfs').insert({
                supplier: { ...parsed.supplier, access_key: parsed.access_key } as any,
                products: parsed.products as any,
                total_value: parsed.total_value,
                import_date: new Date().toISOString()
            });

            if (nfError) {
                addToast(`Erro ao registrar nota fiscal: ${nfError.message}`, 'error');
                return;
            }

            for (const p of parsed.products) {
                const { data: existing } = await supabase.from('products').select('*').eq('id', p.code).maybeSingle();
                
                if (existing) {
                    await supabase.from('products').update({ 
                        quantity: existing.quantity + p.quantity,
                        unit_price: p.unit_price 
                    }).eq('id', p.code);
                } else {
                    await supabase.from('products').insert({
                        id: p.code,
                        name: p.name,
                        quantity: p.quantity,
                        unit_price: p.unit_price,
                        min_stock: 0
                    });
                }

                await supabase.from('stock_movements').insert({
                    product_id: p.code,
                    product_name: p.name,
                    type: 'in',
                    quantity: p.quantity,
                    date: new Date().toISOString(),
                    reason: `Importação NF: ${parsed.supplier.name}`
                });
            }
            addToast('NF Importada com sucesso!', 'success');
            addActivityLog(`importou NF de ${parsed.supplier.name}`);
            await fetchData();
        });
      } catch (err: any) {
        addToast(`Erro ao processar XML: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const, sortable: true },
    { header: 'Nome', accessor: 'name' as const, sortable: true },
    { header: 'Qtd', accessor: 'quantity' as const, sortable: true },
    { header: 'Preço', accessor: (item: Product) => item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sortable: true, sortKey: 'unit_price' as const },
    { header: 'Mínimo', accessor: 'min_stock' as const, sortable: true },
  ];

  const formInputClass = "w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Estoque</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus produtos de consumo e insumos.</p>
        </div>
        <div className="flex space-x-2">
            <label className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center cursor-pointer shadow-lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                Importar XML
                <input type="file" accept=".xml" className="hidden" onChange={handleImportXML} />
            </label>
            <button onClick={() => setIsScannerOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center shadow-lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                Escanear
            </button>
            <button onClick={() => { setCurrentProduct(null); setIsProductModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition shadow-lg">
                Novo Produto
            </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nome ou ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <Table<Product>
        columns={columns}
        data={sortedProducts}
        sortConfig={sortConfig}
        requestSort={requestSort}
        actions={(product) => (
          <div className="flex space-x-2">
            <button onClick={() => { setCurrentProduct(product); setStockAction('in'); setStockQuantity(1); setIsStockModalOpen(true); }} title="Entrada" className="text-green-600 hover:bg-green-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setStockAction('out'); setStockQuantity(1); setIsStockModalOpen(true); }} title="Saída" className="text-amber-600 hover:bg-amber-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsQrModalOpen(true); }} title="QR Code" className="text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsProductModalOpen(true); }} title="Editar" className="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
            <button onClick={() => handleDelete(product)} title="Excluir" className="text-red-600 hover:bg-red-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
          </div>
        )}
      />

      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title={currentProduct?.id ? 'Ficha do Produto' : 'Novo Produto'}>
        <form onSubmit={handleProductSubmit} className="space-y-4">
            <div>
                <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Nome Interno</label>
                <input type="text" name="name" defaultValue={currentProduct?.name || ''} required className={formInputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">ID Interno</label>
                    <input type="text" name="id" defaultValue={currentProduct?.id || ''} required disabled={!!currentProduct?.id} className={`${formInputClass} bg-gray-50 dark:bg-gray-900 disabled:text-gray-400`} />
                </div>
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Preço Custo (R$)</label>
                    <input type="number" step="0.01" name="unitPrice" defaultValue={currentProduct?.unit_price ?? ''} required className={`${formInputClass} font-bold text-primary`} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Qtd Atual</label>
                    <input type="number" step="0.01" name="quantity" defaultValue={currentProduct?.quantity ?? ''} required className={formInputClass} />
                </div>
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Mínimo</label>
                    <input type="number" step="1" name="minStock" defaultValue={currentProduct?.min_stock ?? ''} required className={formInputClass} />
                </div>
            </div>
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg mt-4 transition hover:bg-secondary">Gravar Alterações</button>
        </form>
      </Modal>

      <Modal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} title={`Movimentação: ${currentProduct?.name}`}>
          <div className="space-y-4">
              <div className="flex justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                  <span className="text-gray-500 dark:text-gray-400">Estoque Atual</span>
                  <span className="font-bold text-lg">{currentProduct?.quantity}</span>
              </div>
              <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Quantidade para {stockAction === 'in' ? 'Entrada' : 'Saída'}</label>
                  <input type="number" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} min="0.01" step="0.01" className={formInputClass} />
              </div>
              {stockAction === 'out' && (
                  <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Funcionário Responsável</label>
                        <select value={stockEmployeeId} onChange={e => setStockEmployeeId(e.target.value)} className={formInputClass}>
                            <option value="">Selecione...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ordem de Serviço (Opcional)</label>
                        <select value={stockWorkOrderId} onChange={e => setStockWorkOrderId(e.target.value)} className={formInputClass}>
                            <option value="">Nenhuma / Uso Geral</option>
                            {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.title}</option>)}
                        </select>
                    </div>
                  </div>
              )}
              <button onClick={handleStockAction} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition ${stockAction === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  Confirmar {stockAction === 'in' ? 'Entrada' : 'Saída'}
              </button>
          </div>
      </Modal>

      {currentProduct && (
        <QRCodeModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title={`QR Code: ${currentProduct.name}`} data={currentProduct.id} />
      )}

      <QRCodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(data) => { setSearchTerm(data); addToast(`Produto ${data} localizado`, 'success'); }} addToast={addToast} />

    </div>
  );
};
