
import React, { useState, useMemo, useEffect } from 'react';
import { Product, StockMovement, Asset, MaintenanceRecord, WorkOrder } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface ReportsProps {}

const convertToCSV = (data: any[], headers: { [key: string]: string }): string => {
  const headerRow = Object.values(headers).join(',');
  const rows = data.map(row => {
    return Object.keys(headers).map(key => {
      let cell = row[key] === null || row[key] === undefined ? '' : row[key];
      cell = String(cell).replace(/"/g, '""');
      if (typeof cell === 'string' && cell.includes(',')) {
        cell = `"${cell}"`;
      }
      return cell;
    }).join(',');
  });
  return [headerRow, ...rows].join('\n');
};

const downloadCSV = (csvString: string, filename: string) => {
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


export const Reports: React.FC<ReportsProps> = () => {
    const supabase = useSupabase();
    const [products, setProducts] = useState<Product[]>([]);
    const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    
    useEffect(() => {
        const fetchData = async () => {
            const [p, sm, a, mr, wo] = await Promise.all([
                supabase.from('products').select('*'),
                supabase.from('stock_movements').select('*'),
                supabase.from('assets').select('*'),
                supabase.from('maintenance_records').select('*'),
                supabase.from('work_orders').select('*'),
            ]);
            if (p.data) setProducts(p.data);
            if (sm.data) setStockMovements(sm.data as unknown as StockMovement[]);
            if (a.data) setAssets(a.data);
            if (mr.data) setMaintenanceRecords(mr.data as unknown as MaintenanceRecord[]);
            if (wo.data) setWorkOrders(wo.data as unknown as WorkOrder[]);
        };
        fetchData();
    }, [supabase]);

    const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig<StockMovement> | null>(null);

    const requestSort = (key: keyof StockMovement) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedMovements = useMemo(() => {
        let sortableItems = [...stockMovements];
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
        } else {
            // Default sort by date descending
            sortableItems.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        return sortableItems;
    }, [stockMovements, sortConfig]);

    const handleDownloadInventory = () => {
        const dataToExport = products.map(p => ({
            id: p.id,
            name: p.name,
            quantity: p.quantity,
            unitPrice: p.unit_price,
            totalValue: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0)
        }));
        const headers = {
            id: 'Código',
            name: 'Nome',
            quantity: 'Quantidade',
            unitPrice: 'Preço Unitário',
            totalValue: 'Valor Total'
        };
        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, 'relatorio_inventario.csv');
    };
    
    const handleDownloadMovements = () => {
        const dataToExport = stockMovements.map(m => ({
            date: new Date(m.date).toLocaleString('pt-BR'),
            product_id: m.product_id,
            product_name: m.product_name,
            type: m.type === 'in' ? 'Entrada' : 'Saída',
            quantity: m.quantity,
            employee_name: m.employee_name || 'N/A',
            reason: m.reason || ''
        }));
         const headers = {
            date: 'Data',
            product_id: 'Cód. Produto',
            product_name: 'Produto',
            type: 'Tipo',
            quantity: 'Quantidade',
            employee_name: 'Funcionário',
            reason: 'Motivo'
        };
        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, 'relatorio_movimentacoes.csv');
    };
    
    const movementColumns = [
        { header: 'Data', accessor: (item: StockMovement) => new Date(item.date).toLocaleString('pt-BR'), sortable: true, sortKey: 'date' as const },
        { header: 'Produto', accessor: 'product_name' as const, sortable: true },
        { header: 'Tipo', accessor: (item: StockMovement) => item.type === 'in' ? 
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Entrada</span> : 
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Saída</span> 
        , sortable: true, sortKey: 'type' as const},
        { header: 'Quantidade', accessor: 'quantity' as const, sortable: true },
        { header: 'Funcionário', accessor: 'employee_name' as const, sortable: true },
        { header: 'Comprovante', accessor: (item: StockMovement) => (
            item.receipt_photo ? (
                <button onClick={() => setViewingReceipt(item.receipt_photo!)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Ver</button>
            ) : (
                <span className="text-gray-400 dark:text-gray-500">-</span>
            )
        )},
    ];

     const workOrderCosts = useMemo(() => {
        return workOrders.map(wo => {
            const totalCost = stockMovements
                .filter(m => m.work_order_id === wo.id && m.type === 'out')
                .reduce((acc, mov) => {
                    const product = products.find(p => p.id === mov.product_id);
                    return acc + ((Number(mov.quantity) || 0) * (Number(product?.unit_price) || 0));
                }, 0);
            return { ...wo, totalCost };
        });
    }, [workOrders, stockMovements, products]);


    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Relatórios</h2>
                <p className="text-gray-500 dark:text-gray-400">Exporte os dados do sistema para análise.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Inventário de Estoque</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Baixe uma lista completa de todos os produtos em estoque, incluindo quantidades e valor total.</p>
                    <button onClick={handleDownloadInventory} className="w-full bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                        Baixar CSV
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                    <div className="flex items-center space-x-3">
                         <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M7 9l4-4 4 4M4 20v-5h5m-5 5l4-4 4 4"></path></svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Movimentações de Estoque</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Exporte o histórico completo de todas as entradas e saídas de produtos do estoque.</p>
                    <button onClick={handleDownloadMovements} className="w-full bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                        Baixar CSV
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                    Custo por Ordem de Serviço
                </h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                         <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">OS</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Custo Total de Materiais</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                             {workOrderCosts.map(wo => (
                                <tr key={wo.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{wo.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{wo.status}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{wo.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                    Histórico de Movimentações
                </h3>
                <Table<StockMovement>
                    columns={movementColumns}
                    data={sortedMovements}
                    sortConfig={sortConfig}
                    requestSort={requestSort}
                />
            </div>
            
            <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title="Comprovante de Entrada">
                {viewingReceipt && <img src={viewingReceipt} alt="Comprovante" className="w-full h-auto rounded-md" />}
            </Modal>
        </div>
    );
};
