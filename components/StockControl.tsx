
import React, { useState, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { Product, Employee, ToastMessage, User, WorkOrder, PriceHistory, ParsedNFe, NFeProduct } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';
import { QRCodeModal } from './shared/QRCodeModal';
import { QRCodeScannerModal } from './shared/QRCodeScannerModal';
import { parseNFeXML, cleanName } from '../services/nfeParser';
import { parseFiscalDocument } from '../services/geminiService';

interface StockControlProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const StockControl: React.FC<StockControlProps> = ({ 
    addToast, showConfirmation, addActivityLog, currentUser
}) => {
  const supabase = useSupabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [isProcessingIA, setIsProcessingIA] = useState(false);
  
  // Estados para Seleção e Revisão
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<ParsedNFe | null>(null);
  const [mappings, setMappings] = useState<Record<number, string | 'NEW'>>({});

  const fetchData = useCallback(async () => {
    const [p, e, wo] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('employees').select('*'),
      supabase.from('work_orders').select('*'),
    ]);
    if (p.data) setProducts(p.data);
    if (e.data) setEmployees(e.data);
    if (wo.data) setWorkOrders(wo.data as unknown as WorkOrder[]);
  }, [supabase]);

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
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
  
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockAction, setStockAction] = useState<'in' | 'out'>('in');
  const [stockQuantity, setStockQuantity] = useState<number | string>(1);
  const [stockEmployeeId, setStockEmployeeId] = useState<string>('');
  const [stockWorkOrderId, setStockWorkOrderId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<Product>>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

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

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    showConfirmation(`Tem certeza que deseja excluir ${selectedIds.length} produtos selecionados? Esta ação não pode ser desfeita.`, async () => {
        const { error } = await supabase.from('products').delete().in('id', selectedIds);
        if (error) {
            addToast(`Erro ao excluir em massa: ${error.message}`, 'error');
        } else {
            addToast(`${selectedIds.length} produtos excluídos com sucesso!`, 'success');
            addActivityLog(`excluiu em massa ${selectedIds.length} produtos.`);
            setSelectedIds([]);
            await fetchData();
        }
    });
  };

  // Lógica de mapeamento inteligente na abertura do modal de revisão
  const openReviewModal = (parsed: ParsedNFe) => {
      const initialMappings: Record<number, string | 'NEW'> = {};
      
      parsed.products.forEach((p, index) => {
          const matchById = products.find(existing => existing.id === p.code);
          if (matchById) {
              initialMappings[index] = matchById.id;
              return;
          }
          const cleanNfeName = cleanName(p.name).toLowerCase();
          const matchByName = products.find(existing => cleanName(existing.name).toLowerCase() === cleanNfeName);
          if (matchByName) {
              initialMappings[index] = matchByName.id;
              return;
          }
          initialMappings[index] = 'NEW';
      });

      setMappings(initialMappings);
      setPendingImport(parsed);
  };

  const confirmFinalImport = async () => {
      if (!pendingImport) return;
      
      setIsProcessingIA(true);
      try {
          const { data: existingSupplier } = await supabase
              .from('suppliers')
              .select('id')
              .eq('cnpj', pendingImport.supplier.cnpj)
              .maybeSingle();

          if (!existingSupplier) {
              await supabase.from('suppliers').insert({
                  name: pendingImport.supplier.name,
                  cnpj: pendingImport.supplier.cnpj,
                  contact: 'Cadastrado via Importação'
              });
              addActivityLog(`cadastrou automaticamente o fornecedor ${pendingImport.supplier.name} via importação.`);
          }

          const { error: nfError } = await supabase.from('nfs').insert({
              supplier: { ...pendingImport.supplier, access_key: pendingImport.access_key || null } as any,
              products: pendingImport.products as any,
              total_value: pendingImport.total_value,
              import_date: new Date().toISOString()
          });

          if (nfError) throw new Error(`Erro ao salvar NF: ${nfError.message}`);

          for (let i = 0; i < pendingImport.products.length; i++) {
              const p = pendingImport.products[i];
              const mappingId = mappings[i];
              
              let targetId = p.code;
              if (mappingId && mappingId !== 'NEW') {
                  targetId = mappingId;
              }

              const { data: existing } = await supabase.from('products').select('*').eq('id', targetId).maybeSingle();

              if (!existing || existing.unit_price !== p.unit_price) {
                  await supabase.from('price_history').insert({
                      product_id: targetId,
                      price: p.unit_price,
                      date: new Date().toISOString(),
                      supplier_name: pendingImport.supplier.name
                  });
              }

              if (existing) {
                  await supabase.from('products').update({ 
                      quantity: existing.quantity + p.quantity,
                      unit_price: p.unit_price 
                  }).eq('id', targetId);
              } else {
                  await supabase.from('products').insert({
                      id: targetId,
                      name: p.name,
                      quantity: p.quantity,
                      unit_price: p.unit_price,
                      min_stock: 0
                  });
              }

              await supabase.from('stock_movements').insert({
                  product_id: targetId,
                  product_name: p.name,
                  type: 'in',
                  quantity: p.quantity,
                  date: new Date().toISOString(),
                  reason: `Importação: ${pendingImport.supplier.name}`
              });
          }

          addToast('Importação concluída com sucesso!', 'success');
          addActivityLog(`importou documento de ${pendingImport.supplier.name} com revisão.`);
          setPendingImport(null);
          await fetchData();
      } catch (err: any) {
          addToast(err.message, 'error');
      } finally {
          setIsProcessingIA(false);
      }
  };

  const handleImportXML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const xml = event.target?.result as string;
        const parsed = await parseNFeXML(xml);
        openReviewModal(parsed);
      } catch (err: any) {
        addToast(`Erro ao processar XML: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleImportCupom = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessingIA(true);
      addToast("Aguarde, a IA está analisando o cupom...", "info");
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const base64 = event.target?.result as string;
              const parsed = await parseFiscalDocument(base64, file.type);
              openReviewModal(parsed);
          } catch (err: any) {
              addToast(err.message || "Erro ao processar cupom com IA.", "error");
          } finally {
              setIsProcessingIA(false);
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
  };

  const handleProductSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const unit_price = parseFloat(formData.get('unitPrice') as string);
    const quantity = parseFloat(formData.get('quantity') as string);
    const min_stock = parseFloat(formData.get('minStock') as string);

    if (currentProduct?.id) {
      if (currentProduct.unit_price !== unit_price) {
          await supabase.from('price_history').insert({
              product_id: currentProduct.id,
              price: unit_price,
              date: new Date().toISOString(),
              supplier_name: 'Alteração Manual'
          });
      }
      const { error } = await supabase.from('products').update({ name, unit_price, quantity, min_stock }).eq('id', currentProduct.id);
      if (error) addToast(`Erro ao atualizar: ${error.message}`, 'error');
      else {
        addToast('Produto atualizado!', 'success');
        addActivityLog(`atualizou o produto ${name}`);
        await fetchData();
        setIsProductModalOpen(false);
      }
    } else {
      const id = formData.get('id') as string;
      const { error } = await supabase.from('products').insert({ id, name, unit_price, quantity, min_stock });
      if (error) addToast(`Erro ao cadastrar: ${error.message}`, 'error');
      else {
        await supabase.from('price_history').insert({ product_id: id, price: unit_price, date: new Date().toISOString(), supplier_name: 'Cadastro Inicial' });
        addToast('Produto cadastrado!', 'success');
        addActivityLog(`cadastrou o produto ${name}`);
        await fetchData();
        setIsProductModalOpen(false);
      }
    }
  };

  const handleStockAction = async () => {
    if (!currentProduct) return;
    const qty = parseFloat(stockQuantity as string);
    const newQty = stockAction === 'in' ? currentProduct.quantity + qty : currentProduct.quantity - qty;
    if (newQty < 0) { addToast('Erro: Estoque insuficiente.', 'error'); return; }
    const { error } = await supabase.from('products').update({ quantity: newQty }).eq('id', currentProduct.id);
    if (error) { addToast(`Erro ao movimentar: ${error.message}`, 'error'); return; }
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

  const viewPriceHistory = async (product: Product) => {
      setCurrentProduct(product);
      const { data } = await supabase.from('price_history').select('*').eq('product_id', product.id).order('date', { ascending: false });
      if (data) setPriceHistory(data as unknown as PriceHistory[]);
      setIsPriceHistoryModalOpen(true);
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const, sortable: true, hiddenMobile: true },
    { header: 'Nome', accessor: 'name' as const, sortable: true, className: "font-medium" },
    { header: 'Qtd', accessor: (item: Product) => (
        <div className="flex flex-col">
            <span className="font-black text-gray-900 dark:text-white">
                {item.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
            </span>
            <span className="text-[10px] md:hidden text-gray-500 uppercase font-bold">Saldo</span>
        </div>
    ), sortable: true, sortKey: 'quantity' as const },
    { header: 'Preço', accessor: (item: Product) => item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sortable: true, sortKey: 'unit_price' as const, hiddenMobile: true },
    { header: 'Mínimo', accessor: 'min_stock' as const, sortable: true, hiddenMobile: true },
  ];

  const formInputClass = "w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200";

  const FractionButton = ({ label, value }: { label: string, value: number }) => (
    <button 
        type="button"
        onClick={() => setStockQuantity(value)}
        className="flex-1 py-2 px-3 bg-gray-100 dark:bg-gray-700 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300"
    >
        {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Estoque</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus produtos de consumo e insumos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {selectedIds.length > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center shadow-lg animate-pulse"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Excluir ({selectedIds.length})
                </button>
            )}
            <label className={`bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center cursor-pointer shadow-lg`}>
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
          className="w-full pl-10 pr-4 py-3 border rounded-xl dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary/20 transition-all outline-none shadow-sm"
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
        selectedItems={selectedIds}
        setSelectedItems={setSelectedIds}
        actions={(product) => (
          <div className="flex space-x-1">
            <button onClick={() => { setCurrentProduct(product); setStockAction('in'); setStockQuantity(1); setIsStockModalOpen(true); }} title="Entrada" className="text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setStockAction('out'); setStockQuantity(1); setIsStockModalOpen(true); }} title="Saída" className="text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsQrModalOpen(true); }} title="QR Code" className="text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/30 p-2 rounded-lg transition hidden md:block"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsProductModalOpen(true); }} title="Editar" className="text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
            {currentUser.role !== 'stockist' && (
              <button onClick={() => viewPriceHistory(product)} title="Histórico de Preços" className="text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 p-2 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </button>
            )}
            <button onClick={() => handleDelete(product)} title="Excluir" className="text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 p-2 rounded-lg transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
          </div>
        )}
      />

      {/* MODAL DE REVISÃO DE IMPORTAÇÃO */}
      <Modal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} title={`Revisão de Importação: ${pendingImport?.supplier.name}`}>
          <div className="space-y-6">
              <p className="text-sm text-gray-500">Verifique os itens abaixo e vincule-os corretamente.</p>
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                  {pendingImport?.products.map((item, idx) => (
                      <div key={idx} className="p-4 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 space-y-3">
                          <div className="flex justify-between items-start">
                              <div className="flex-1">
                                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase">{item.name}</h4>
                                  <p className="text-[10px] text-gray-500 font-mono">Cód. Nota: {item.code} | Vlr: {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                              </div>
                              <div className="text-right ml-4"><span className="text-sm font-bold text-primary">+{item.quantity} un</span></div>
                          </div>
                          <div>
                              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Vincular ao Produto:</label>
                              <select value={mappings[idx]} onChange={e => setMappings(prev => ({...prev, [idx]: e.target.value}))} className="w-full p-2 text-xs border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                  <option value="NEW">✨ CADASTRAR COMO NOVO ITEM</option>
                                  <optgroup label="PRODUTOS EM ESTOQUE">
                                      {products.map(p => (<option key={p.id} value={p.id}>{p.name} (Saldo: {p.quantity})</option>))}
                                  </optgroup>
                              </select>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="flex flex-col space-y-2">
                  <button onClick={confirmFinalImport} disabled={isProcessingIA} className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-secondary transition disabled:opacity-50">{isProcessingIA ? 'Processando...' : 'Confirmar e Alimentar Estoque'}</button>
                  <button onClick={() => setPendingImport(null)} className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition">Cancelar Importação</button>
              </div>
          </div>
      </Modal>

      {/* Histórico de Preços */}
      <Modal isOpen={isPriceHistoryModalOpen} onClose={() => setIsPriceHistoryModalOpen(false)} title={`Histórico de Preços: ${currentProduct?.name}`}>
          <div className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                          <tr>
                              <th className="p-3 text-xs font-bold uppercase text-gray-500">Data</th>
                              <th className="p-3 text-xs font-bold uppercase text-gray-500">Fornecedor/Origem</th>
                              <th className="p-3 text-xs font-bold uppercase text-gray-500 text-right">Preço</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-700">
                          {priceHistory.map((h, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                  <td className="p-3 text-sm">{new Date(h.date).toLocaleDateString('pt-BR')}</td>
                                  <td className="p-3 text-sm font-medium">{h.supplier_name || 'N/A'}</td>
                                  <td className="p-3 text-sm font-bold text-right text-primary">{h.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </Modal>

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
                    <input type="number" step="0.001" name="quantity" defaultValue={currentProduct?.quantity ?? ''} required className={formInputClass} />
                </div>
                <div>
                    <label className="text-[11px] font-bold uppercase text-gray-500 mb-1 block">Mínimo</label>
                    <input type="number" step="1" name="minStock" defaultValue={currentProduct?.min_stock ?? ''} required className={formInputClass} />
                </div>
            </div>
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg mt-4 transition hover:bg-secondary">Gravar Alterações</button>
        </form>
      </Modal>

      {/* MODAL DE MOVIMENTAÇÃO MELHORADO COM ATALHOS DE FRAÇÃO */}
      <Modal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} title={`Movimentação: ${currentProduct?.name}`}>
          <div className="space-y-6">
              {/* Card de Saldo Atual */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border dark:border-gray-700 flex justify-between items-center">
                  <div>
                      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Estoque em Mãos</p>
                      <p className="text-2xl font-black text-gray-800 dark:text-white">
                          {currentProduct?.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                      </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stockAction === 'in' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                      {stockAction === 'in' ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12"></path></svg>
                      ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path></svg>
                      )}
                  </div>
              </div>

              <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Quantidade para {stockAction === 'in' ? 'Entrada' : 'Saída'}</label>
                  <input 
                      type="number" 
                      value={stockQuantity} 
                      onChange={e => setStockQuantity(e.target.value)} 
                      min="0.001" 
                      step="0.001" 
                      placeholder="Ex: 0,68"
                      className="w-full p-4 text-xl font-bold border-2 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" 
                  />
                  
                  {/* BOTÕES DE FRAÇÃO RÁPIDA */}
                  <div className="flex flex-wrap gap-2 mt-3">
                      <FractionButton label="1/4" value={0.25} />
                      <FractionButton label="1/2" value={0.50} />
                      <FractionButton label="3/4" value={0.75} />
                      <FractionButton label="1 un" value={1.00} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 italic">Dica: Use os atalhos acima ou digite manualmente.</p>
              </div>

              {stockAction === 'out' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Funcionário Responsável</label>
                        <select value={stockEmployeeId} onChange={e => setStockEmployeeId(e.target.value)} className={formInputClass}>
                            <option value="">Selecione quem está retirando...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Vincular à Ordem de Serviço (Opcional)</label>
                        <select value={stockWorkOrderId} onChange={e => setStockWorkOrderId(e.target.value)} className={formInputClass}>
                            <option value="">Nenhuma / Uso Geral na Oficina</option>
                            {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.title}</option>)}
                        </select>
                    </div>
                  </div>
              )}

              <div className="pt-2">
                  <button 
                      onClick={handleStockAction} 
                      className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl transition-all active:scale-95 flex items-center justify-center space-x-2 ${stockAction === 'in' ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'}`}
                  >
                      <span>Confirmar {stockAction === 'in' ? 'Entrada no Estoque' : 'Saída do Material'}</span>
                  </button>
                  <button onClick={() => setIsStockModalOpen(false)} className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-red-500 transition">Cancelar Operação</button>
              </div>
          </div>
      </Modal>

      {currentProduct && (
        <QRCodeModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title={`QR Code: ${currentProduct.name}`} data={currentProduct.id} />
      )}
      <QRCodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(data) => { setSearchTerm(data); addToast(`Produto ${data} localizado`, 'success'); }} addToast={addToast} />
    </div>
  );
};
