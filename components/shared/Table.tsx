
import React, { ReactNode } from 'react';

export type SortConfig<T> = {
    key: keyof T;
    direction: 'ascending' | 'descending';
} | null;

interface TableProps<T> {
    columns: { header: string; accessor: keyof T | ((item: T) => ReactNode); sortable?: boolean; sortKey?: keyof T }[];
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
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        {setSelectedItems && (
                             <th scope="col" className="px-6 py-3">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary dark:bg-gray-900 dark:checked:bg-primary"
                                    onChange={handleSelectAll}
                                    checked={selectedItems && data.length > 0 && selectedItems.length === data.length}
                                />
                            </th>
                        )}
                        {columns.map((col, index) => (
                            <th key={index} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                {col.sortable ? (
                                    <button onClick={() => requestSort((col.sortKey || col.accessor) as keyof T)} className="flex items-center space-x-1">
                                        <span>{col.header}</span>
                                        <span>{getSortIndicator((col.sortKey || col.accessor) as keyof T)}</span>
                                    </button>
                                ) : (
                                    col.header
                                )}
                            </th>
                        ))}
                        {actions && (
                            <th scope="col" className="sticky right-0 bg-gray-50 dark:bg-gray-700 px-6 py-3 text-right">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</span>
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.length > 0 ? data.map((item) => (
                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedItems?.includes(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                             {setSelectedItems && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                     <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary dark:bg-gray-900 dark:checked:bg-primary"
                                        checked={selectedItems?.includes(item.id)}
                                        onChange={() => handleSelectItem(item.id)}
                                    />
                                </td>
                            )}
                            {columns.map((col, index) => (
                                <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                    {typeof col.accessor === 'function'
                                        ? col.accessor(item)
                                        : (item[col.accessor] as ReactNode)}
                                </td>
                            ))}
                            {actions && (
                                <td className="sticky right-0 bg-white dark:bg-gray-800 px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-2">
                                        {actions(item)}
                                    </div>
                                </td>
                            )}
                        </tr>
                    )) : (
                        <tr>
                           <td colSpan={columns.length + (actions ? 1 : 0) + (setSelectedItems ? 1: 0)} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                Nenhum dado encontrado.
                           </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};
