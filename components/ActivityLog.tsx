import React, { useState, useMemo, useEffect } from 'react';
import { ActivityLog as IActivityLog } from '../types';
import { Table, SortConfig } from './shared/Table';
import { useSupabase } from '../contexts/SupabaseContext';

interface ActivityLogProps {}

export const ActivityLog: React.FC<ActivityLogProps> = () => {
  const supabase = useSupabase();
  const [logs, setLogs] = useState<IActivityLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
        const { data, error } = await supabase.from('activity_logs').select('*');
        if (data) setLogs(data);
    };
    fetchLogs();

    const channel = supabase.channel('activity-logs-db-changes');
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, (payload) => {
        if (payload.eventType === 'INSERT') setLogs(current => [...current, payload.new as IActivityLog]);
    }).subscribe();

    return () => {
        supabase.removeChannel(channel);
    }
  }, [supabase]);


  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<IActivityLog>>({ key: 'timestamp', direction: 'descending' });

  const filteredLogs = useMemo(() => {
    return logs.filter(log =>
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);
  
  const requestSort = (key: keyof IActivityLog) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedLogs = useMemo(() => {
    let sortableItems = [...filteredLogs];
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
  }, [filteredLogs, sortConfig]);

  const columns = [
    { header: 'Data e Hora', accessor: (item: IActivityLog) => new Date(item.timestamp).toLocaleString('pt-BR'), sortable: true, sortKey: 'timestamp' as const },
    { header: 'Usuário', accessor: 'user' as const, sortable: true },
    { header: 'Ação', accessor: 'action' as const, sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Log de Atividades</h2>
        <p className="text-gray-500 dark:text-gray-400">Trilha de auditoria de todas as ações importantes no sistema.</p>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por usuário ou ação..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>
      
      <Table<IActivityLog>
        columns={columns}
        data={sortedLogs}
        sortConfig={sortConfig}
        requestSort={requestSort}
      />
    </div>
  );
};