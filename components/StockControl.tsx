
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
    addToast, showConfirmation, addActivityLog
}) => {
  const supabase = useSupabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [isProcessingIA, setIsProcessingIA] = useState(false);
  
  // Estados para Revisão de Importação
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

  // Lógica de mapeamento inteligente na abertura do modal de revisão
  const openReviewModal = (parsed: ParsedNFe) => {
      const initialMappings: Record<number, string | 'NEW'> = {};
      
      parsed.products.forEach((p, index) => {
          // 1. Tenta por ID exato
          const matchById = products.find(existing => existing.id === p.code);
          if (matchById) {
              initialMappings[index] = matchById.id;
              return;
          }

          // 2. Tenta por Nome exato (limpo)
          const cleanNfeName = cleanName(p.name).toLowerCase();
          const matchByName = products.find(existing => cleanName(existing.name).toLowerCase() === cleanNfeName);
          if (matchByName) {
              initialMappings[index] = matchByName.id;
              return;
          }

          // 3. Senão, marca como NOVO por padrão
          initialMappings[index] = 'NEW';
      });

      setMappings(initialMappings);
      setPendingImport(parsed);
  };

  const confirmFinalImport = async () => {
      if (!pendingImport) return;
      
      setIsProcessingIA(true);
      try {
          // Registrar a Nota Fiscal
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
              let isNew = true;

              if (mappingId && mappingId !== 'NEW') {
                  targetId = mappingId;
                  isNew = false;
              }

              const { data: existing } = await supabase.from('products').select('*').eq('id', targetId).maybeSingle();

              // Gravar Histórico
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

      const { error } = await supabase.from('products').update({
        name, unit_price, quantity, min_stock
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
        id, name, unit_price, quantity, min_stock
      });

      if (error) addToast(`Erro ao cadastrar: ${error.message}`, 'error');
      else {
        await supabase.from('price_history').insert({
            product_id: id,
            price: unit_price,
            date: new Date().toISOString(),
            supplier_name: 'Cadastro Inicial'
        });
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
      const { data } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', product.id)
        .order('date', { ascending: false });
      
      if (data) setPriceHistory(data as unknown as PriceHistory[]);
      setIsPriceHistoryModalOpen(true);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Estoque</h2>
          <p className="text-gray-500 dark:text-gray-400">Gerencie seus produtos de consumo e insumos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <label className={`bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center cursor-pointer shadow-lg ${isProcessingIA ? 'opacity-50 pointer-events-none' : ''}`}>
                {isProcessingIA ? (
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                )}
                Importar Cupom (IA)
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleImportCupom} disabled={isProcessingIA} />
            </label>
            <label className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center cursor-pointer shadow-lg">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                XML NFe
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
            <button onClick={() => viewPriceHistory(product)} title="Histórico de Preço" className="text-purple-600 hover:bg-purple-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsQrModalOpen(true); }} title="QR Code" className="text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg></button>
            <button onClick={() => { setCurrentProduct(product); setIsProductModalOpen(true); }} title="Editar" className="text-indigo-600 hover:text-indigo-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
            <button onClick={() => handleDelete(product)} title="Excluir" className="text-red-600 hover:bg-red-100 p-1.5 rounded-full transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
          </div>
        )}
      />

      {/* MODAL DE REVISÃO DE IMPORTAÇÃO */}
      <Modal 
        isOpen={!!pendingImport} 
        onClose={() => setPendingImport(null)} 
        title={`Revisão de Importação: ${pendingImport?.supplier.name}`}
      >
          <div className="space-y-6">
              <p className="text-sm text-gray-500">
                  Verifique os itens abaixo. O sistema sugeriu vínculos baseados no nome ou código. 
                  Você pode escolher "Cadastrar como NOVO" ou selecionar um produto já existente para evitar duplicidade.
              </p>
              
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2">
                  {pendingImport?.products.map((item, idx) => (
                      <div key={idx} className="p-4 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 space-y-3">
                          <div className="flex justify-between items-start">
                              <div className="flex-1">
                                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase">{item.name}</h4>
                                  <p className="text-[10px] text-gray-500 font-mono">Cód. Nota: {item.code} | Vlr: {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                              </div>
                              <div className="text-right ml-4">
                                  <span className="text-sm font-bold text-primary">+{item.quantity} un</span>
                              </div>
                          </div>
                          
                          <div>
                              <label className="text-[10px] font-bold uppercase text-gray-400 mb-1 block">Vincular ao Produto:</label>
                              <select 
                                  value={mappings[idx]} 
                                  onChange={e => setMappings(prev => ({...prev, [idx]: e.target.value}))}
                                  className="w-full p-2 text-xs border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                              >
                                  <option value="NEW" className="font-bold text-emerald-600 italic">✨ CADASTRAR COMO NOVO ITEM</option>
                                  <optgroup label="PRODUTOS EM ESTOQUE">
                                      {products.map(p => (
                                          <option key={p.id} value={p.id}>
                                              {p.name} (Saldo: {p.quantity})
                                          </option>
                                      ))}
                                  </optgroup>
                              </select>
                          </div>
                      </div>
                  ))}
              </div>

              <div className="flex flex-col space-y-2">
                  <button 
                      onClick={confirmFinalImport}
                      disabled={isProcessingIA}
                      className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-secondary transition disabled:opacity-50"
                  >
                      {isProcessingIA ? 'Processando...' : 'Confirmar e Alimentar Estoque'}
                  </button>
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
                          {priceHistory.length === 0 && (
                              <tr><td colSpan={3} className="p-10 text-center text-gray-400 italic">Sem registros de alteração de preço.</td></tr>
                          )}
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
