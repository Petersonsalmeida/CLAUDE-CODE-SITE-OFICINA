
import React, { useState, useRef, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { Product, Supplier, StockMovement, ParsedNFe, Employee, PriceHistory, Category, ToastMessage, NFe, WorkOrder, User, NFeProduct } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { parseNFeXML } from '../services/nfeParser';
import { parseInvoicePDF } from '../services/geminiService';
import { useSupabase } from '../contexts/SupabaseContext';
import { QRCodeScannerModal } from './shared/QRCodeScannerModal';

interface StockControlProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

type ViewMode = 'table' | 'cards';
type StockStatusFilter = 'all' | 'critical' | 'warning' | 'healthy' | 'out';

export const StockControl: React.FC<StockControlProps> = ({ 
    addToast, showConfirmation, addActivityLog, currentUser
}) => {
  const supabase = useSupabase();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');

  const fetchData = useCallback(async () => {
    const [prodRes, empRes, priceRes, catRes, woRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('employees').select('*'),
        supabase.from('price_history').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('work_orders').select('*')
    ]);
    if(prodRes.data) setProducts(prodRes.data);
    if(empRes.data) setEmployees(empRes.data);
    if(priceRes.data) setPriceHistory(priceRes.data);
    if(catRes.data) setCategories(catRes.data);
    if(woRes.data) setWorkOrders(woRes.data as unknown as WorkOrder[]);
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('stock-v8').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData()).on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchData]);

  const [isNFeModalOpen, setIsNFeModalOpen] = useState(false);
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
  
  // Estados para Importação de NF
  const [nfeData, setNfeData] = useState<ParsedNFe | null>(null);
  const [mappedItems, setMappedItems] = useState<Record<string, string>>({}); // supplierCode -> internalId
  const [isLoadingNFe, setIsLoadingNFe] = useState(false);
  
  const [outQuantity, setOutQuantity] = useState<number | string>(1);
  const [outEmployeeId, setOutEmployeeId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<Product> | null>(null);

  const productsAlphabetical = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoadingNFe(true);
    
    try {
        const reader = new FileReader();
        if (file.type === 'application/pdf') {
            reader.onload = async (e) => {
                const base64 = (e.target?.result as string).split(',')[1];
                const parsed = await parseInvoicePDF(base64);
                setNfeData(parsed);
                const initialMapping: Record<string, string> = {};
                parsed.products.forEach(p => {
                    if (products.some(internal => internal.id === p.code)) initialMapping[p.code] = p.code;
                });
                setMappedItems(initialMapping);
                setIsLoadingNFe(false);
            };
            reader.readAsDataURL(file);
        } else {
            reader.onload = async (e) => {
                const parsed = await parseNFeXML(e.target?.result as string);
                setNfeData(parsed);
                const initialMapping: Record<string, string> = {};
                parsed.products.forEach(p => {
                    if (products.some(internal => internal.id === p.code)) initialMapping[p.code] = p.code;
                });
                setMappedItems(initialMapping);
                setIsLoadingNFe(false);
            };
            reader.readAsText(file);
        }
    } catch (err) { 
        addToast('Erro ao ler arquivo', 'error'); 
        setIsLoadingNFe(false);
    }
  };

  const finalizeNFeImport = async () => {
    if (!nfeData) return;
    setIsLoadingNFe(true);
    
    try {
        for (const item of nfeData.products) {
            const internalId = mappedItems[item.code];
            
            if (internalId) {
                const existing = products.find(p => p.id === internalId);
                if (existing) {
                    const newQty = Number(existing.quantity) + Number(item.quantity);
                    await supabase.from('products').update({ 
                        quantity: newQty, 
                        unit_price: item.unit_price 
                    }).eq('id', internalId);
                    
                    // Salva histórico com o nome do fornecedor da nota
                    await supabase.from('price_history').insert({
                        product_id: internalId, 
                        price: item.unit_price, 
                        supplier_name: nfeData.supplier.name, // REGISTRO DO FORNECEDOR
                        date: new Date().toISOString()
                    });
                }
            } else {
                await supabase.from('products').insert({
                    id: item.code,
                    name: item.name,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    min_stock: 10
                });
                await supabase.from('price_history').insert({
                    product_id: item.code, 
                    price: item.unit_price, 
                    supplier_name: nfeData.supplier.name,
                    date: new Date().toISOString()
                });
            }

            await supabase.from('stock_movements').insert({
                product_id: internalId || item.code,
                product_name: item.name,
                type: 'in',
                quantity: item.quantity,
                reason: `Entrada via NF: ${nfeData.supplier.name}`,
                date: new Date().toISOString()
            });
        }
        
        addToast('NF Importada com Sucesso!', 'success');
        setIsNFeModalOpen(false);
        setNfeData(null);
        fetchData();
    } catch (err: any) {
        addToast(`Erro na importação: ${err.message}`, 'error');
    } finally {
        setIsLoadingNFe(false);
    }
  };

  const handleProductSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = currentProduct?.id ? currentProduct.id : (formData.get('id') as string);
    const newPrice = parseFloat(formData.get('unitPrice') as string);
    
    if (currentProduct?.id) {
        if (currentProduct.unit_price !== newPrice) {
            await supabase.from('price_history').insert({ product_id: id, price: newPrice, supplier_name: 'Ajuste Manual', date: new Date().toISOString() });
        }
        await supabase.from('products').update({
            name: formData.get('name') as string,
            quantity: parseFloat(formData.get('quantity') as string),
            unit_price: newPrice,
            category_id: formData.get('categoryId') as string || null,
            min_stock: parseFloat(formData.get('minStock') as string) || 0,
        }).eq('id', id);
        addToast('Produto atualizado!', 'success');
    } else {
        const prodData = {
            id,
            name: formData.get('name') as string,
            quantity: parseFloat(formData.get('quantity') as string),
            unit_price: newPrice,
            category_id: formData.get('categoryId') as string || null,
            min_stock: parseFloat(formData.get('minStock') as string) || 0,
        };
        await supabase.from('products').insert(prodData);
        await supabase.from('price_history').insert({ product_id: id, price: newPrice, supplier_name: 'Cadastro Inicial', date: new Date().toISOString() });
        addToast('Produto cadastrado!', 'success');
    }
    setIsProductModalOpen(false);
    fetchData();
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
      if (statusFilter === 'all') return matchesSearch;
      const min = p.min_stock || 0;
      if (statusFilter === 'critical') return matchesSearch && p.quantity < min;
      if (statusFilter === 'out') return matchesSearch && p.quantity <= 0;
      return matchesSearch;
    });
  }, [products, searchTerm, statusFilter]);

  const columns = [
    { header: 'Produto', accessor: (item: Product) => (
        <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white">{item.name}</span>
            <span className="text-[10px] text-gray-400 font-mono">ID: {item.id}</span>
        </div>
    ), sortable: true, sortKey: 'name' as const },
    { header: 'Estoque', accessor: (item: Product) => <span className={`font-mono font-bold ${item.quantity < (item.min_stock || 0) ? 'text-red-600' : ''}`}>{item.quantity}</span> },
    { header: 'Preço Atual', accessor: (item: Product) => item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
  ];

  // Cálculo do melhor preço para o produto selecionado
  const bestPrice = useMemo(() => {
      if (!selectedProduct) return 0;
      const history = priceHistory.filter(h => h.product_id === selectedProduct.id);
      if (history.length === 0) return 0;
      return Math.min(...history.map(h => h.price));
  }, [selectedProduct, priceHistory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Estoque (Consumo)</h2>
            <p className="text-gray-500 dark:text-gray-400">Gerencie níveis e analise histórico de preços.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => { setCurrentProduct({ name: '', quantity: 0, unit_price: 0, min_stock: 10 }); setIsProductModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center shadow-lg">
                Novo Produto
            </button>
            <button onClick={() => { setNfeData(null); setIsNFeModalOpen(true); }} className="bg-white dark:bg-gray-800 border text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold flex items-center shadow-sm">
                Importar NF
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="md:col-span-2 p-3 border rounded-xl dark:bg-gray-800 outline-none" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StockStatusFilter)} className="p-3 border rounded-xl dark:bg-gray-800 outline-none">
              <option value="all">Todos os Itens</option>
              <option value="critical">Estoque Crítico</option>
              <option value="out">Zerados</option>
          </select>
      </div>

      <Table<Product>
          columns={columns}
          data={filteredProducts}
          actions={(product) => (
          <div className="flex space-x-1">
              <button onClick={() => { setSelectedProduct(product); setIsPriceHistoryModalOpen(true); }} title="Histórico de Preços" className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
              <button onClick={() => { setSelectedProduct(product); setOutQuantity(1); setIsOutModalOpen(true); }} className="text-amber-500 hover:bg-amber-50 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg></button>
              <button onClick={() => { setCurrentProduct(product); setIsProductModalOpen(true); }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
          </div>
          )}
          sortConfig={sortConfig}
          requestSort={(k) => setSortConfig({ key: k, direction: sortConfig?.direction === 'ascending' ? 'descending' : 'ascending' })}
      />

      {/* MODAL DE IMPORTAÇÃO DE NF */}
      <Modal isOpen={isNFeModalOpen} onClose={() => !isLoadingNFe && setIsNFeModalOpen(false)} title="Importação Inteligente de NF">
        <div className="space-y-6">
            {!nfeData ? (
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-10 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer relative">
                    <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".xml,.pdf" />
                    <svg className="w-16 h-16 text-primary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="text-gray-600 dark:text-gray-400 font-bold">Clique ou arraste o XML ou PDF da Nota</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-bold text-blue-600 uppercase">Fornecedor Identificado:</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{nfeData.supplier.name}</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                        {nfeData.products.map((item) => (
                            <div key={item.code} className="p-3 bg-white dark:bg-gray-800 border rounded-xl shadow-sm space-y-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Na Nota: {item.code}</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
                                    </div>
                                    <div className="text-right ml-4">
                                        <p className="text-sm font-black text-primary">{item.quantity} un</p>
                                        <p className="text-[10px] text-gray-400">R$ {item.unit_price.toFixed(2)}</p>
                                    </div>
                                </div>
                                <select 
                                    value={mappedItems[item.code] || ''} 
                                    onChange={(e) => setMappedItems({...mappedItems, [item.code]: e.target.value})}
                                    className="w-full p-2 text-xs border rounded-lg dark:bg-gray-900 outline-none"
                                >
                                    <option value="">+ Cadastrar como NOVO produto</option>
                                    {productsAlphabetical.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} (Saldo: {p.quantity})</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <button onClick={finalizeNFeImport} disabled={isLoadingNFe} className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-secondary disabled:opacity-50">
                        {isLoadingNFe ? 'Processando...' : 'Confirmar Entrada'}
                    </button>
                </div>
            )}
        </div>
      </Modal>

      {/* HISTÓRICO DE PREÇOS COM FORNECEDOR */}
      <Modal isOpen={isPriceHistoryModalOpen} onClose={() => setIsPriceHistoryModalOpen(false)} title={`Histórico de Preços - ${selectedProduct?.name}`}>
            <div className="space-y-4">
                {priceHistory.filter(h => h.product_id === selectedProduct?.id).length > 0 ? (
                    <div className="divide-y dark:divide-gray-700">
                        {priceHistory.filter(h => h.product_id === selectedProduct?.id).map(h => (
                            <div key={h.id} className="py-4 flex justify-between items-center group">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <p className="text-lg font-black text-gray-800 dark:text-gray-100">
                                            {h.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                        {h.price === bestPrice && (
                                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-200">Melhor Preço</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                                        {h.supplier_name || 'Fornecedor não informado'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 font-medium">
                                        {new Date(h.date).toLocaleDateString('pt-BR')}
                                    </p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Data da Compra</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-10 text-gray-400 italic">Nenhum histórico disponível.</p>
                )}
            </div>
      </Modal>

      {/* Modal Ficha do Produto */}
      <Modal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} title={currentProduct?.id ? 'Ficha do Produto' : 'Novo Produto'}>
        <form onSubmit={handleProductSubmit} className="space-y-4">
            <div>
                <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Nome Interno</label>
                <input type="text" name="name" defaultValue={currentProduct?.name} required className="w-full p-3 border rounded-xl dark:bg-gray-800" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">ID Interno</label>
                    <input type="text" name="id" defaultValue={currentProduct?.id} required disabled={!!currentProduct?.id} className="w-full p-3 border rounded-xl dark:bg-gray-800 bg-gray-50 disabled:text-gray-400" />
                </div>
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Preço Custo (R$)</label>
                    <input type="number" step="0.01" name="unitPrice" defaultValue={currentProduct?.unit_price} required className="w-full p-3 border rounded-xl dark:bg-gray-800 font-bold text-primary" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Qtd Atual</label>
                    <input type="number" step="0.01" name="quantity" defaultValue={currentProduct?.quantity} required className="w-full p-3 border rounded-xl dark:bg-gray-800" />
                </div>
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Mínimo</label>
                    <input type="number" step="1" name="minStock" defaultValue={currentProduct?.min_stock} required className="w-full p-3 border rounded-xl dark:bg-gray-800" />
                </div>
            </div>
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg mt-4">Gravar Alterações</button>
        </form>
      </Modal>

      {/* Modal Saída */}
      <Modal isOpen={isOutModalOpen} onClose={() => setIsOutModalOpen(false)} title="Registrar Saída">
          {selectedProduct && (
              <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border">
                    <p className="text-sm font-bold">{selectedProduct.name}</p>
                    <p className="text-sm font-bold mt-1 text-blue-600">Saldo: {selectedProduct.quantity}</p>
                  </div>
                  <input type="number" value={outQuantity} onChange={e => setOutQuantity(e.target.value)} className="w-full p-4 border rounded-xl dark:bg-gray-800 text-xl font-bold" />
                  <select value={outEmployeeId} onChange={e => setOutEmployeeId(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-gray-800">
                      <option value="">Quem está retirando?</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <button onClick={async () => {
                      const qty = Number(outQuantity);
                      if(!outEmployeeId || qty <= 0) { addToast('Preencha os dados', 'warning'); return; }
                      await supabase.from('products').update({ quantity: selectedProduct.quantity - qty }).eq('id', selectedProduct.id);
                      await supabase.from('stock_movements').insert({ product_id: selectedProduct.id, product_name: selectedProduct.name, type: 'out', quantity: qty, employee_name: employees.find(e => e.id === outEmployeeId)?.name, date: new Date().toISOString() });
                      addToast('Saída registrada!', 'success');
                      setIsOutModalOpen(false);
                      fetchData();
                  }} className="w-full py-4 bg-red-500 text-white font-bold rounded-xl shadow-lg">Confirmar Retirada</button>
              </div>
          )}
      </Modal>
    </div>
  );
};
