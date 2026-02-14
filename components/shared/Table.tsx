
import React, { ReactNode } from 'react';

export type SortConfig<T> = {
    key: keyof T;
    direction: 'ascending' | 'descending';
} | null;

interface TableProps<T> {
    columns: { 
        header: string; 
        accessor: keyof T | ((item: T) => ReactNode); 
        sortable?: boolean; 
        sortKey?: keyof T;
        hiddenMobile?: boolean; // Nova propriedade para ocultar no mobile
        className?: string;     // Nova propriedade para estilos customizados
    }[];
    data: T[];
    actions?: (item: T) => ReactNode;
    sortConfig: SortConfig<T>;
    requestSort: (key: keyof T) => void;
    
    // For selection
    selectedItems?: string[]; // array of item ids
    setSelectedItems?: (ids: string[]) => void;
}

export const Table = <T extends { id: string }>(
    { columns, data, actions, sortConfig, requestSort, selectedItems, setSelectedItems }: TableProps<T>
) => {

    const getSortIndicator = (key: keyof T) => {
        if (!sortConfig || sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedItems?.(data.map(item => item.id));
        } else {
            setSelectedItems?.([]);
        }
    };

    const handleSelectItem = (id: string) => {
        if (!selectedItems || !setSelectedItems) return;
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(itemId => itemId !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };
    
    return (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        {setSelectedItems && (
                             <th scope="col" className="px-4 py-3 w-10">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary dark:bg-gray-900"
                                    onChange={handleSelectAll}
                                    checked={selectedItems && data.length > 0 && selectedItems.length === data.length}
                                />
                            </th>
                        )}
                        {columns.map((col, index) => (
                            <th 
                                key={index} 
                                scope="col" 
                                className={`px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.hiddenMobile ? 'hidden md:table-cell' : ''}`}
                            >
                                {col.sortable ? (
                                    <button onClick={() => requestSort((col.sortKey || col.accessor) as keyof T)} className="flex items-center space-x-1 hover:text-primary transition-colors">
                                        <span>{col.header}</span>
                                        <span className="text-[10px] opacity-70">{getSortIndicator((col.sortKey || col.accessor) as keyof T)}</span>
                                    </button>
                                ) : (
                                    col.header
                                )}
                            </th>
                        ))}
                        {actions && (
                            <th scope="col" className="sticky right-0 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-right w-20">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</span>
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {data.length > 0 ? data.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedItems?.includes(item.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                             {setSelectedItems && (
                                <td className="px-4 py-4">
                                     <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary dark:bg-gray-900"
                                        checked={selectedItems?.includes(item.id)}
                                        onChange={() => handleSelectItem(item.id)}
                                    />
                                </td>
                            )}
                            {columns.map((col, index) => (
                                <td 
                                    key={index} 
                                    className={`px-4 py-4 text-sm text-gray-700 dark:text-gray-300 ${col.hiddenMobile ? 'hidden md:table-cell' : ''} ${col.className || ''}`}
                                >
                                    {typeof col.accessor === 'function'
                                        ? col.accessor(item)
                                        : (item[col.accessor] as ReactNode)}
                                </td>
                            ))}
                            {actions && (
                                <td className="sticky right-0 bg-white dark:bg-gray-800 px-4 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-1">
                                        {actions(item)}
                                    </div>
                                </td>
                            )}
                        </tr>
                    )) : (
                        <tr>
                           <td colSpan={columns.length + (actions ? 1 : 0) + (setSelectedItems ? 1: 0)} className="text-center py-16 text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center">
                                    <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                    Nenhum dado encontrado.
                                </div>
                           </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
