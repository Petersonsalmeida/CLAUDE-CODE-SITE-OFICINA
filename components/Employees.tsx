import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Employee, ToastMessage, User } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface EmployeesProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Employees: React.FC<EmployeesProps> = ({ addToast, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<Employee> | null>(null);

    useEffect(() => {
        const fetchEmployees = async () => {
            const { data, error } = await supabase.from('employees').select('*');
            if(error) addToast(`Erro ao carregar funcionários: ${error.message}`, 'error');
            else if (data) setEmployees(data);
        };
        fetchEmployees();

        const channel = supabase.channel('employees-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                setEmployees(current => {
                    if (current.some(item => item.id === payload.new.id)) return current;
                    return [...current, payload.new as Employee];
                });
            }
            if (payload.eventType === 'UPDATE') {
                setEmployees(current => current.map(item => item.id === payload.new.id ? payload.new as Employee : item));
            }
            if (payload.eventType === 'DELETE') {
                setEmployees(current => current.filter(item => item.id !== (payload.old as Employee).id));
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [supabase, addToast]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(e =>
            e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.role.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm]);

    const requestSort = (key: keyof Employee) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedEmployees = useMemo(() => {
        let sortableItems = [...filteredEmployees];
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
        }
        return sortableItems;
    }, [filteredEmployees, sortConfig]);

    const openModal = (employee: Employee | null = null) => {
        setCurrentEmployee(employee);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setCurrentEmployee(null);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const employeeData = {
            name: formData.get('name') as string,
            role: formData.get('role') as string,
            contact: formData.get('contact') as string,
        };

        if (currentEmployee) {
            const originalEmployees = employees;
            setEmployees(prev => prev.map(emp => emp.id === currentEmployee.id ? {...emp, ...employeeData} : emp));
            const { error } = await supabase.from('employees').update(employeeData).eq('id', currentEmployee.id);
            if (error) {
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                setEmployees(originalEmployees); // Revert
            } else {
                addToast('Funcionário atualizado com sucesso!', 'success');
                addActivityLog(`atualizou o funcionário: ${employeeData.name}`);
            }
        } else {
            const { data, error } = await supabase.from('employees').insert(employeeData).select().single();
            if (error) {
                addToast(`Erro ao criar: ${error.message}`, 'error');
            } else if (data) {
                setEmployees(prev => [...prev, data]); // Manual update
                addToast('Funcionário criado com sucesso!', 'success');
                addActivityLog(`criou o funcionário: ${employeeData.name}`);
            }
        }
        closeModal();
    };

    const handleDelete = (employee: Employee) => {
        showConfirmation('Tem certeza que deseja excluir este funcionário?', async () => {
            const originalEmployees = employees;
            setEmployees(prev => prev.filter(e => e.id !== employee.id));
            const { error } = await supabase.from('employees').delete().eq('id', employee.id);
             if (error) {
                addToast(`Erro ao excluir: ${error.message}`, 'error');
                setEmployees(originalEmployees); // Revert
            } else {
                addToast('Funcionário excluído com sucesso!', 'success');
                addActivityLog(`excluiu o funcionário: ${employee.name}`);
            }
        });
    };
    
    const columns = [
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { header: 'Cargo', accessor: 'role' as const, sortable: true },
        { header: 'Contato', accessor: 'contact' as const, sortable: true },
    ];
    
    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Funcionários</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie sua equipe.</p>
                </div>
                <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                    Novo Funcionário
                </button>
            </div>

            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome ou cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<Employee>
                columns={columns}
                data={sortedEmployees}
                actions={(employee) => (
                   <>
                        <button onClick={() => openModal(employee)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(employee)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome</label>
                        <input type="text" name="name" id="name" defaultValue={currentEmployee?.name} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="role" className={formLabelClass}>Cargo</label>
                        <input type="text" name="role" id="role" defaultValue={currentEmployee?.role} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="contact" className={formLabelClass}>Contato</label>
                        <input type="text" name="contact" id="contact" defaultValue={currentEmployee?.contact || ''} className={formInputClass}/>
                    </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <button type="button" onClick={closeModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};