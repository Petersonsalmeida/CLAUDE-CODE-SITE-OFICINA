
import React, { useState, useRef, useMemo, FormEvent, useEffect, useCallback } from 'react';
import { Product, Supplier, StockMovement, ParsedNFe, Employee, PriceHistory, Category, ToastMessage, NFe, WorkOrder, User } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { parseNFeXML } from '../services/nfeParser';
import { parseInvoicePDF } from '../services/geminiService';
import { CameraModal } from './shared/CameraModal';
import { useSupabase } from '../contexts/SupabaseContext';
import { QRCodeScannerModal } from './shared/QRCodeScannerModal';


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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const [prodRes, supRes, empRes, priceRes, catRes, woRes, smRes] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('suppliers').select('*'),
            supabase.from('employees').select('*'),
            supabase.from('price_history').select('*'),
            supabase.from('categories').select('*'),
            supabase.from('work_orders').select('*'),
            supabase.from('stock_movements').select('*')
        ]);
        if(prodRes.data) setProducts(prodRes.data);
        if(supRes.data) setSuppliers(supRes.data);
        if(empRes.data) setEmployees(empRes.data);
        if(priceRes.data) setPriceHistory(priceRes.data);
        if(catRes.data) setCategories(catRes.data);
        if(woRes.data) setWorkOrders(woRes.data as unknown as WorkOrder[]);
        if(smRes.data) setStockMovements(smRes.data as unknown as StockMovement[]);
    };
    fetchData();

    const channel = supabase.channel('stock-control-db-changes');
    const setupSubscription = (table: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setter(current => {
            if (current.some(item => item.id === payload.new.id)) return current;
            return [...current, payload.new as any];
          });
        }
        if (payload.eventType === 'UPDATE') {
          setter(current => current.map(item => item.id === payload.new.id ? payload.new as any : item));
        }
        if (payload.eventType === 'DELETE') {
          setter(current => current.filter(item => item.id !== payload.old.id));
        }
      }).subscribe();
    };

    const tablesToSubscribe = [
        { table: 'products', setter: setProducts },
        { table: 'suppliers', setter: setSuppliers },
        { table: 'employees', setter: setEmployees },
        { table: 'price_history', setter: setPriceHistory },
        { table: 'categories', setter: setCategories },
        { table: 'work_orders', setter: setWorkOrders },
        { table: 'stock_movements', setter: setStockMovements }
    ];
    tablesToSubscribe.forEach(({ table, setter }) => setupSubscription(table, setter));

    return () => {
        supabase.removeChannel(channel);
    };

  }, [supabase]);


  const [isNFeModalOpen, setIsNFeModalOpen] = useState(false);
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product> | null>(null);
  const [receiptData, setReceiptData] = useState({
    productId: '',
    quantity: 1,
    unitPrice: '',
    photo: '',
    photoName: ''
  });

  const [outQuantity, setOutQuantity] = useState<number | string>(1);
  const [outEmployeeId, setOutEmployeeId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nfeData, setNfeData] = useState<ParsedNFe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<Product> | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [outWorkOrderId, setOutWorkOrderId] = useState<string>('');


  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (categoryFilter === '' || p.category_id === categoryFilter)
    );
  }, [products, searchTerm, categoryFilter]);

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
  }, [filteredProducts, sortConfig]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      setNfeData(null);
      
      if (file.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  const base64 = (e.target?.result as string).split(',')[1];
                  const parsedData = await parseInvoicePDF(base64);
                  setNfeData(parsedData);
              } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erro ao processar PDF com IA');
              } finally {
                  setIsLoading(false);
              }
          };
          reader.readAsDataURL(file);
      } else { // Assume XML
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  const content = e.target?.result as string;
                  const parsedData = await parseNFeXML(content);
                  setNfeData(parsedData);
              } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erro ao processar XML');
              } finally {
                  setIsLoading(false);
              }
          };
          reader.readAsText(file);
      }
    }
  };
  
    const addStockMovement = useCallback(async (movement: Omit<StockMovement, 'id' | 'date' | 'user_id'>) => {
    const { data, error } = await supabase.from('stock_movements').insert({ ...movement, date: new Date().toISOString() }).select().single();
    if(error) {
        addToast(`Erro ao registrar movimento: ${error.message}`, 'error');
    } else if(data) {
        setStockMovements(prev => [...prev, data as unknown as StockMovement]);
    }
  }, [addToast, supabase]);

  const addNf = useCallback(async (nf: Omit<NFe, 'id' | 'user_id'>) => {
    const { error } = await supabase.from('nfs').insert(nf as any).select().single();
    if(error) {
        addToast(`Erro ao salvar NF: ${error.message}`, 'error');
    }
  }, [addToast, supabase]);


  const confirmNFeImport = async () => {
    if (!nfeData) return;

    let supplier = suppliers.find(s => s.cnpj === nfeData.supplier.cnpj);

    if (!supplier && nfeData.supplier.cnpj) {
        const { data: existingData } = await supabase
            .from('suppliers')
            .select('*')
            .eq('cnpj', nfeData.supplier.cnpj)
            .maybeSingle();

        if (existingData) {
            supplier = existingData;
            if (!suppliers.some(s => s.id === existingData.id)) {
                setSuppliers(prev => [...prev, existingData]);
            }
        } else {
            const { data: newlyCreatedSupplierData, error: insertError } = await supabase
                .from('suppliers')
                .insert({
                    name: nfeData.supplier.name,
                    cnpj: nfeData.supplier.cnpj,
                })
                .select(); 

            if (insertError) {
                addToast(`Erro ao criar novo fornecedor: ${insertError.message}`, 'error');
                return;
            }
            
            if (newlyCreatedSupplierData && newlyCreatedSupplierData.length > 0) {
                supplier = newlyCreatedSupplierData[0];
                if (supplier) setSuppliers(prev => [...prev, supplier as Supplier]);
            } else {
                 const { data: refetchData } = await supabase.from('suppliers').select('*').eq('cnpj', nfeData.supplier.cnpj).maybeSingle();
                 if(refetchData) {
                     supplier = refetchData;
                     setSuppliers(prev => [...prev, supplier as Supplier]);
                 }
            }
        }
    }

    const productsToUpsert = [];
    const movementsToInsert = [];
    const pricesToInsert = [];

    for (const nfeProd of nfeData.products) {
        const existingProduct = products.find(p => p.id === nfeProd.code);
        const newQuantity = (existingProduct ? existingProduct.quantity : 0) + nfeProd.quantity;

        productsToUpsert.push({
            id: nfeProd.code,
            name: nfeProd.name,
            quantity: newQuantity,
            unit_price: nfeProd.unit_price,
        });

        const lastPriceEntry = priceHistory
            .filter(ph => ph.product_id === nfeProd.code)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        const lastPrice = lastPriceEntry ? lastPriceEntry.price : (existingProduct ? existingProduct.unit_price : 0);

        if (nfeProd.unit_price !== lastPrice) {
            pricesToInsert.push({
                product_id: nfeProd.code,
                price: nfeProd.unit_price,
                date: new Date().toISOString(),
            });
        }
        
        movementsToInsert.push({
            product_id: nfeProd.code,
            product_name: nfeProd.name,
            type: 'in' as const,
            quantity: nfeProd.quantity,
            reason: `NF-e ${nfeData.supplier.cnpj}`,
        });
    }
    
    setProducts(prev => {
        const updated = [...prev];
        productsToUpsert.forEach(upserted => {
            const idx = updated.findIndex(p => p.id === upserted.id);
            if (idx >= 0) updated[idx] = { ...updated[idx], ...upserted };
            else updated.push(upserted as Product);
        });
        return updated;
    });
    
    
    const { error: productsError } = await supabase.from('products').upsert(productsToUpsert);
    if (productsError) {
        addToast(`Erro ao atualizar produtos: ${productsError.message}`, 'error');
        return;
    }
    
    const { data: insertedMovements, error: movementsError } = await supabase.from('stock_movements').insert(movementsToInsert).select();
    if (movementsError) {
        addToast(`Erro ao registrar movimentos: ${movementsError.message}`, 'error');
    } else if (insertedMovements) {
        setStockMovements(prev => [...prev, ...(insertedMovements as unknown as StockMovement[])]);
    }

    if (pricesToInsert.length > 0) {
        const { error: pricesError } = await supabase.from('price_history').insert(pricesToInsert);
        if (pricesError) addToast(`Erro ao salvar histórico de preços: ${pricesError.message}`, 'error');
    }

    const totalValue = nfeData.products.reduce((acc, prod) => acc + (prod.quantity * prod.unit_price), 0);
    const newNf: Omit<NFe, 'id' | 'user_id'> = {
        supplier: nfeData.supplier,
        products: nfeData.products,
        total_value: totalValue,
        import_date: new Date().toISOString(),
    };
    await addNf(newNf);

    addActivityLog(`importou NF-e de ${nfeData.supplier.name}.`);
    addToast(`${nfeData.products.length} itens importados com sucesso!`, 'success');
    closeNFeModal();
  };
  
  const handleProductSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = currentProduct?.id ? currentProduct.id : (formData.get('id') as string);
    const productData = {
        id: id,
        name: formData.get('name') as string,
        quantity: parseFloat(formData.get('quantity') as string),
        unit_price: parseFloat(formData.get('unitPrice') as string),
        category_id: formData.get('categoryId') as string || null,
        min_stock: parseFloat(formData.get('minStock') as string) || 0,
    };
    
    if (!currentProduct?.id && products.some(p => p.id === id)) {
        addToast('Erro: Já existe um produto com este código.', 'error');
        return;
    }

    if (currentProduct?.id) {
        const originalProducts = products;
        setProducts(prev => prev.map(p => p.id === currentProduct.id ? { ...p, ...productData } : p));
        const { error } = await supabase.from('products').update(productData).eq('id', currentProduct.id);
        if (error) {
            addToast(`Erro ao atualizar: ${error.message}`, 'error');
            setProducts(originalProducts);
        } else {
            addToast('Produto atualizado com sucesso!', 'success');
            addActivityLog(`atualizou o produto: ${productData.name}.`);
        }
    } else {
        const { data, error } = await supabase.from('products').insert(productData).select().single();
        if (error) {
             addToast(`Erro ao criar: ${error.message}`, 'error');
        } else if (data) {
             setProducts(prev => [...prev, data]);
             await addStockMovement({
                product_id: id,
                product_name: productData.name,
                type: 'in',
                quantity: productData.quantity,
                reason: 'Cadastro manual'
            });
            const { error: priceError } = await supabase.from('price_history').insert({
                product_id: id,
                price: productData.unit_price,
                date: new Date().toISOString()
            });
            if (priceError) addToast(`Erro ao salvar preço: ${priceError.message}`, 'warning');
            addToast('Produto cadastrado com sucesso!', 'success');
            addActivityLog(`cadastrou o produto: ${productData.name}.`);
        }
    }
    closeProductModal();
  };

  const handleDeleteProduct = (id: string, name: string) => {
    showConfirmation('Tem certeza que deseja excluir este produto?', async () => {
        const originalProducts = products;
        setProducts(prev => prev.filter(p => p.id !== id));
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            addToast(`Erro ao excluir: ${error.message}`, 'error');
            setProducts(originalProducts);
        } else {
            addToast('Produto excluído com sucesso!', 'success');
            addActivityLog(`excluiu o produto: ${name}.`);
        }
    });
  }

  const handleDeleteSelected = () => {
      showConfirmation(`Tem certeza que deseja excluir ${selectedItems.length} produtos?`, async () => {
          const originalProducts = products;
          const selectedNames = products.filter(p => selectedItems.includes(p.id)).map(p => p.name).join(', ');
          setProducts(prev => prev.filter(p => !selectedItems.includes(p.id)));
          const { error } = await supabase.from('products').delete().in('id', selectedItems);
          if (error) {
               addToast(`Erro ao excluir: ${error.message}`, 'error');
               setProducts(originalProducts);
          } else {
            addToast(`${selectedItems.length} produtos excluídos com sucesso!`, 'success');
            addActivityLog(`excluiu ${selectedItems.length} produtos: ${selectedNames}.`);
            setSelectedItems([]);
          }
      });
  }

  const handleReceiptPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setReceiptData(prev => ({ ...prev, photo: reader.result as string, photoName: file.name }));
        };
        reader.readAsDataURL(file);
    }
  };

   const handleCameraCapture = (imageData: string) => {
    setReceiptData(prev => ({ ...prev, photo: imageData, photoName: `captura_${Date.now()}.jpg` }));
    setIsCameraModalOpen(false);
  };

  const handleReceiptSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { productId, quantity, unitPrice, photo } = receiptData;
    const product = products.find(p => p.id === productId);

    if (!product || quantity <= 0) {
        addToast("Produto ou quantidade inválida.", "error");
        return;
    }
    
    const newQuantity = product.quantity + quantity;
    const newPrice = unitPrice ? parseFloat(unitPrice) : product.unit_price;

    const originalProducts = products;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: newQuantity, unit_price: newPrice } : p));

    const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity, unit_price: newPrice })
        .eq('id', productId);

    if (updateError) {
        addToast(`Erro ao atualizar produto: ${updateError.message}`, 'error');
        setProducts(originalProducts);
        return;
    }
    
    await addStockMovement({
        product_id: product.id,
        product_name: product.name,
        type: 'in',
        quantity: quantity,
        reason: 'Entrada avulsa com comprovante',
        receipt_photo: photo
    });

    if (unitPrice) {
        const { error: priceError } = await supabase.from('price_history').insert({
            product_id: product.id,
            price: parseFloat(unitPrice),
            date: new Date().toISOString()
        });
        if (priceError) addToast(`Erro ao salvar histórico de preço: ${priceError.message}`, 'warning');
    }
    
    addToast("Entrada avulsa registrada com sucesso!", "success");
    addActivityLog(`registrou entrada avulsa de ${quantity}x ${product.name}.`);
    closeReceiptModal();
  };

  const closeNFeModal = () => {
    setIsNFeModalOpen(false);
    setNfeData(null);
    setError(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  }

  const openOutModal = (product: Product) => {
    setSelectedProduct(product);
    setOutQuantity(1);
    setOutEmployeeId(employees.length > 0 ? employees[0].id : '');
    setOutWorkOrderId('');
    setIsOutModalOpen(true);
  };
  
  const openProductModal = (product: Product | null) => {
    setCurrentProduct(product ? {...product} : { id: '', name: '', quantity: 0, unit_price: 0, min_stock: 10 });
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setCurrentProduct(null);
    setIsProductModalOpen(false);
  };

  const openPriceHistoryModal = (product: Product) => {
    setSelectedProduct(product);
    setIsPriceHistoryModalOpen(true);
  };
    
  const closePriceHistoryModal = () => {
    setIsPriceHistoryModalOpen(false);
    setSelectedProduct(null);
  };
  
  const openReceiptModal = () => {
    setReceiptData({ productId: products.length > 0 ? products[0].id : '', quantity: 1, unitPrice: '', photo: '', photoName: '' });
    setIsReceiptModalOpen(true);
  }

  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
  }
  
  const handleScan = (code: string) => {
      setSearchTerm(code);
      addToast(`Código ${code} escaneado!`, 'success');
      setIsScannerOpen(false);
  };

  const handleStockOut = async () => {
    const quantity = Number(outQuantity);
    if (!selectedProduct || quantity <= 0 || quantity > selectedProduct.quantity) {
      addToast("Quantidade de saída inválida.", 'error');
      return;
    }
    if (!outEmployeeId) {
        addToast("Por favor, selecione um funcionário.", 'error');
        return;
    }
    
    const originalProduct = products.find(p => p.id === selectedProduct.id);
    if (!originalProduct) return;

    const newQuantity = originalProduct.quantity - quantity;
    setProducts(prev => prev.map(p => p.id === originalProduct.id ? {...p, quantity: newQuantity} : p));

    const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', selectedProduct.id);
    
    if (error) {
        addToast(`Erro ao atualizar estoque: ${error.message}`, 'error');
        setProducts(prev => prev.map(p => p.id === originalProduct.id ? originalProduct : p));
        return;
    }
    
    const employee = employees.find(e => e.id === outEmployeeId);
    const workOrder = workOrders.find(wo => wo.id === outWorkOrderId);

    const reason = workOrder 
        ? `para OS "${workOrder.title}" por ${employee?.name}`
        : `Uso geral por ${employee?.name}`;
    
    await addStockMovement({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      type: 'out',
      quantity: quantity,
      reason: reason,
      employee_id: outEmployeeId,
      employee_name: employee ? employee.name : undefined,
      work_order_id: outWorkOrderId || undefined,
    });
    
    addActivityLog(`registrou saída de ${quantity}x ${selectedProduct.name}.`);
    addToast('Saída registrada! O registro foi enviado ao "Controle de Saídas" para formalização.', 'success');
    setIsOutModalOpen(false);
    setSelectedProduct(null);
  };
  
  const productPriceHistory = useMemo(() => {
    if (!selectedProduct) return [];
    return priceHistory
      .filter(h => h.product_id === selectedProduct.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [priceHistory, selectedProduct]);

  const columns = [
    { header: 'Código', accessor: 'id' as const, sortable: true },
    { header: 'Nome', accessor: 'name' as const, sortable: true },
    { header: 'Quantidade', accessor: 'quantity' as const, sortable: true },
    { header: 'Preço Unitário', accessor: (item: Product) => (currentUser.role !== 'stockist' ? item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '***'), sortable: currentUser.role !== 'stockist', sortKey: 'unit_price' as const},
    { header: 'Valor Total', accessor: (item: Product) => (currentUser.role !== 'stockist' ? ((Number(item.unit_price) || 0) * (Number(item.quantity) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '***'), sortable: false },
  ];
  
  const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";

  return (
    <div className="space-y-6">
      <div className="sm:flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle de Estoque</h2>
            <p className="text-gray-500 dark:text-gray-400">Gerencie os produtos do seu inventário.</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-4 sm:mt-0">
            <button onClick={() => setIsScannerOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Escanear
            </button>
            <button onClick={() => openProductModal(null)} className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition">
                Novo Produto
            </button>
            <button onClick={openReceiptModal} className="bg-teal-600 text-white px-4 py-2 rounded-lg shadow hover:bg-teal-700 transition">
                Entrada Avulsa
            </button>
            <button onClick={() => setIsNFeModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                Entrada (NF-e)
            </button>
        </div>
      </div>
      
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <input
                type="text"
                placeholder="Buscar por código ou nome do produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>
           <div>
               <select
                   value={categoryFilter}
                   onChange={(e) => setCategoryFilter(e.target.value)}
                   className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
               >
                   <option value="">Todas as Categorias</option>
                   {categories.map(cat => (
                       <option key={cat.id} value={cat.id}>{cat.name}</option>
                   ))}
               </select>
           </div>
      </div>

       {selectedItems.length > 0 && (
          <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg flex items-center justify-between">
              <span className="text-blue-800 dark:text-blue-300 font-medium">{selectedItems.length} item(s) selecionado(s)</span>
              <button
                  onClick={handleDeleteSelected}
                  className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 transition"
              >
                  Excluir Selecionados
              </button>
          </div>
      )}
      
      <Table<Product>
        columns={columns}
        data={sortedProducts}
        actions={(product) => (
          <>
            {currentUser.role !== 'stockist' && 
                <button onClick={() => openPriceHistoryModal(product)} title="Histórico de Preços" className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            }
            <button onClick={() => openOutModal(product)} title="Saída de Estoque" className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
            </button>
            <button onClick={() => openProductModal(product)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button onClick={() => handleDeleteProduct(product.id, product.name)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
          </>
        )}
        sortConfig={sortConfig}
        requestSort={requestSort}
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
      />

      <Modal isOpen={isNFeModalOpen} onClose={closeNFeModal} title="Importar Produtos por NF-e (XML ou PDF)">
        <div className="space-y-4">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary" accept=".xml,.pdf" />
          {isLoading && <p>Processando...</p>}
          {error && <p className="text-red-500">{error}</p>}
          {nfeData && (
            <div>
              <h4 className="font-bold">Dados da NF-e</h4>
              <p><strong>Fornecedor:</strong> {nfeData.supplier.name}</p>
              <p><strong>CNPJ:</strong> {nfeData.supplier.cnpj}</p>
              <h5>Produtos ({nfeData.products.length}):</h5>
              <ul>
                {nfeData.products.slice(0, 5).map((p, i) => <li key={i}>{p.quantity}x {p.name}</li>)}
                {nfeData.products.length > 5 && <li>... e mais {nfeData.products.length - 5} itens.</li>}
              </ul>
              <button onClick={confirmNFeImport} className="bg-green-500 text-white px-4 py-2 rounded mt-2">Confirmar Importação</button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isOutModalOpen} onClose={() => setIsOutModalOpen(false)} title="Registrar Saída de Estoque">
        {selectedProduct && (
          <div className="space-y-4">
            <p><strong>Produto:</strong> {selectedProduct.name}</p>
            <p><strong>Estoque atual:</strong> {selectedProduct.quantity}</p>
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
              <input type="number" id="quantity" value={outQuantity} onChange={e => setOutQuantity(e.target.value)} min="0.01" step="0.01" max={selectedProduct.quantity} className={formInputClass} />
              <div className="flex space-x-2 mt-2">
                {[0.25, 1/3, 0.5, 2/3, 0.75].map(frac => (
                    <button 
                        key={frac} 
                        type="button" 
                        onClick={() => {
                            const val = parseFloat(frac.toFixed(4));
                            setOutQuantity(val);
                        }} 
                        className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition"
                    >
                        {(frac * 100).toFixed(0)}%
                    </button>
                ))}
                <button type="button" onClick={() => setOutQuantity(selectedProduct.quantity)} className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition">Tudo</button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">* As porcentagens aplicam-se a 1 unidade do material.</p>
            </div>
            <div>
                <label htmlFor="employee" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Funcionário</label>
                <select id="employee" value={outEmployeeId} onChange={e => setOutEmployeeId(e.target.value)} className={formInputClass} required>
                  <option value="" disabled>Selecione um funcionário</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
            </div>
            <div>
              <label htmlFor="workorder" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ordem de Serviço (Opcional)</label>
              <select id="workorder" value={outWorkOrderId} onChange={(e) => setOutWorkOrderId(e.target.value)} className={formInputClass}>
                  <option value="">Nenhuma / Uso Geral</option>
                  {workOrders.filter(wo => wo.status !== 'completed').map(wo => (
                      <option key={wo.id} value={wo.id}>{wo.title}</option>
                  ))}
              </select>
            </div>
            <button onClick={handleStockOut} className="bg-red-500 text-white px-4 py-2 rounded w-full">Confirmar Saída</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={isPriceHistoryModalOpen} onClose={closePriceHistoryModal} title={`Histórico de Preços - ${selectedProduct?.name}`}>
        <ul>
          {productPriceHistory.map(h => (
            <li key={h.id} className="border-b py-2 dark:border-gray-700">
              <span className="font-bold">{h.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span> em <span className="text-sm text-gray-500">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal isOpen={isProductModalOpen} onClose={closeProductModal} title={currentProduct?.id ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={handleProductSubmit} className="space-y-4">
            <div>
                <label htmlFor="id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código/ID do Produto</label>
                <input type="text" name="id" id="id" defaultValue={currentProduct?.id} required className={formInputClass} disabled={!!currentProduct?.id}/>
            </div>
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Produto</label>
                <input type="text" name="name" id="name" defaultValue={currentProduct?.name} required className={formInputClass}/>
            </div>
            <div>
                <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
                <select name="categoryId" id="categoryId" defaultValue={currentProduct?.category_id || ''} className={formInputClass}>
                    <option value="">Sem Categoria</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
                    <input type="number" step="0.01" name="quantity" id="quantity" defaultValue={currentProduct?.quantity} required className={formInputClass}/>
                </div>
                <div>
                    <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preço Unitário (R$)</label>
                    <input type="number" step="0.01" name="unitPrice" id="unitPrice" defaultValue={currentProduct?.unit_price} required className={formInputClass}/>
                </div>
            </div>
             <div>
                <label htmlFor="minStock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estoque Mínimo</label>
                <input type="number" step="1" name="minStock" id="minStock" defaultValue={currentProduct?.min_stock || 10} required className={formInputClass}/>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeProductModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isReceiptModalOpen} onClose={closeReceiptModal} title="Entrada Avulsa com Comprovante">
          <form onSubmit={handleReceiptSubmit} className="space-y-4">
            <div>
                <label htmlFor="receiptProductId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
                <select id="receiptProductId" value={receiptData.productId} onChange={e => setReceiptData({...receiptData, productId: e.target.value})} className={formInputClass} required>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="receiptQuantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
                <input type="number" step="0.01" id="receiptQuantity" value={receiptData.quantity} onChange={e => setReceiptData({...receiptData, quantity: parseFloat(e.target.value)})} className={formInputClass} required />
            </div>
             <div>
                <label htmlFor="receiptPrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Novo Preço Unitário (Opcional)</label>
                <input type="number" step="0.01" id="receiptPrice" value={receiptData.unitPrice} onChange={e => setReceiptData({...receiptData, unitPrice: e.target.value})} className={formInputClass} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Foto do Comprovante (Opcional)</label>
                 <div className="mt-1 flex items-center space-x-4">
                    {receiptData.photo && <img src={receiptData.photo} alt="Preview" className="w-20 h-20 object-cover rounded-md" />}
                     <div className="flex items-center space-x-2">
                         <input type="file" id="receipt-photo-upload" accept="image/*" onChange={handleReceiptPhotoChange} className="hidden"/>
                         <label htmlFor="receipt-photo-upload" className="cursor-pointer bg-white dark:bg-gray-700 text-sm text-primary dark:text-accent font-semibold py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                           Escolher Ficheiro
                         </label>
                         <button type="button" onClick={() => setIsCameraModalOpen(true)} className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H12a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M15 9a3 3 0 10-6 0 3 3 0 006 0z" /></svg>
                         </button>
                     </div>
                 </div>
            </div>
            <div className="flex justify-end pt-4 space-x-2">
                <button type="button" onClick={closeReceiptModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Registrar Entrada</button>
            </div>
          </form>
      </Modal>

      <CameraModal isOpen={isCameraModalOpen} onClose={() => setIsCameraModalOpen(false)} onCapture={handleCameraCapture} />
      
      <QRCodeScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan}
        addToast={addToast}
      />

    </div>
  );
};
