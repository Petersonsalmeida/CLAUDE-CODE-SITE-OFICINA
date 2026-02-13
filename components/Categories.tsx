
import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Category, ToastMessage, User, Product } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { useSupabase } from '../contexts/SupabaseContext';

interface CategoriesProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Categories: React.FC<CategoriesProps> = ({ addToast, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<Product[]>([]); // Needed for counting
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Fix: Widen the type of sortConfig to allow 'productCount' which is not in keyof Category
    const [sortConfig, setSortConfig] = useState<{ key: keyof Category | 'productCount'; direction: 'ascending' | 'descending' } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const [catRes, prodRes] = await Promise.all([
                supabase.from('categories').select('*'),
                supabase.from('products').select('id, category_id') // Fetch minimal data for counting
            ]);

            if (catRes.error) addToast(`Erro ao carregar categorias: ${catRes.error.message}`, 'error');
            else if (catRes.data) setCategories(catRes.data);

            if (prodRes.data) setProducts(prodRes.data as unknown as Product[]);
        };
        fetchData();

        const channel = supabase.channel('categories-page-changes');
        
        // Subscribe to categories
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                setCategories(c => {
                    if (c.some(item => item.id === payload.new.id)) return c;
                    return [...c, payload.new as Category];
                });
            }
            if (payload.eventType === 'UPDATE') setCategories(c => c.map(cat => cat.id === payload.new.id ? payload.new as Category : cat));
            if (payload.eventType === 'DELETE') setCategories(c => c.filter(cat => cat.id !== (payload.old as Category).id));
        })
        // Subscribe to products to update counts in real-time
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
             // Re-fetch products to ensure accurate counts (simpler than managing delta state for counts)
             supabase.from('products').select('id, category_id').then(({ data }) => {
                 if (data) setProducts(data as unknown as Product[]);
             });
        })
        .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [supabase, addToast]);

    const filteredCategories = useMemo(() => {
        return categories.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [categories, searchTerm]);

    const getProductCount = (categoryId: string) => {
        return products.filter(p => p.category_id === categoryId).length;
    };

    const requestSort = (key: keyof Category | 'productCount') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedCategories = useMemo(() => {
        let sortableItems = [...filteredCategories];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key;
                
                let valA: any, valB: any;

                if (key === 'productCount') {
                    valA = getProductCount(a.id);
                    valB = getProductCount(b.id);
                } else {
                    valA = a[key as keyof Category] || '';
                    valB = b[key as keyof Category] || '';
                }

                if (typeof valA === 'string') {
                     valA = valA.toLowerCase();
                     valB = valB.toLowerCase();
                }

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
    }, [filteredCategories, sortConfig, products]);

    const openModal = (category: Category | null = null) => {
        setCurrentCategory(category);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setCurrentCategory(null);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const categoryData = {
            name: formData.get('name') as string,
        };

        if (currentCategory) {
            const originalCategories = categories;
            setCategories(prev => prev.map(c => c.id === currentCategory.id ? {...c, ...categoryData} : c));
            const { error } = await supabase.from('categories').update(categoryData).eq('id', currentCategory.id);
            if (error) {
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                setCategories(originalCategories); // Revert
            } else {
                addToast('Categoria atualizada com sucesso!', 'success');
                addActivityLog(`atualizou a categoria: ${categoryData.name}`);
            }
        } else {
            const { data, error } = await supabase.from('categories').insert(categoryData).select().single();
            if (error) {
                addToast('Erro ao criar: ${error.message}', 'error');
            } else if (data) {
                setCategories(prev => [...prev, data]); // Manual update
                addToast('Categoria criada com sucesso!', 'success');
                addActivityLog(`criou a categoria: ${categoryData.name}`);
            }
        }
        closeModal();
    };

    const handleDelete = (category: Category) => {
        const count = getProductCount(category.id);
        const warning = count > 0 ? `Esta categoria possui ${count} produto(s) vinculado(s). ` : '';
        
        showConfirmation(`${warning}Tem certeza que deseja excluir a categoria "${category.name}"?`, async () => {
            const originalCategories = categories;
            setCategories(prev => prev.filter(c => c.id !== category.id));
            
            // If there are products, update them to have null category first (optional but safer)
            if (count > 0) {
                 await supabase.from('products').update({ category_id: null }).eq('category_id', category.id);
            }

            const { error } = await supabase.from('categories').delete().eq('id', category.id);
             if (error) {
                addToast(`Erro ao excluir: ${error.message}`, 'error');
                setCategories(originalCategories); // Revert
            } else {
                addToast('Categoria excluída com sucesso!', 'success');
                addActivityLog(`excluiu a categoria: ${category.name}`);
            }
        });
    };
    
    const columns = [
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { 
            header: 'Produtos Vinculados', 
            accessor: (item: Category) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProductCount(item.id) > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {getProductCount(item.id)} itens
                </span>
            ), 
            sortable: true,
            sortKey: 'productCount' as any // Custom sort key
        },
        { header: 'Criado em', accessor: (item: Category) => new Date(item.created_at || '').toLocaleDateString('pt-BR'), sortable: true, sortKey: 'created_at' as const },
    ];
    
    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Categorias</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie as categorias dos seus produtos.</p>
                </div>
                <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                    Nova Categoria
                </button>
            </div>

            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<Category>
                columns={columns}
                data={sortedCategories}
                actions={(category) => (
                    <>
                        <button onClick={() => openModal(category)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(category)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig as SortConfig<Category>}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentCategory ? 'Editar Categoria' : 'Nova Categoria'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome da Categoria</label>
                        <input type="text" name="name" id="name" defaultValue={currentCategory?.name} required className={formInputClass}/>
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
