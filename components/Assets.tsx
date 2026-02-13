
import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { Asset, MaintenanceRecord, ToastMessage, User } from '../types';
import { Table, SortConfig } from './shared/Table';
import { Modal } from './shared/Modal';
import { QRCodeModal } from './shared/QRCodeModal';
import { CameraModal } from './shared/CameraModal';
import { useSupabase } from '../contexts/SupabaseContext';
import { QRCodeScannerModal } from './shared/QRCodeScannerModal';

interface AssetsProps {
  addToast: (message: string, type: ToastMessage['type']) => void;
  showConfirmation: (message: string, onConfirm: () => void) => void;
  addActivityLog: (action: string) => void;
  currentUser: User;
}

export const Assets: React.FC<AssetsProps> = ({ addToast, showConfirmation, addActivityLog }) => {
    const supabase = useSupabase();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data: assetsData, error: assetsError } = await supabase.from('assets').select('*');
            if(assetsError) addToast(`Erro ao carregar ativos: ${assetsError.message}`, 'error');
            else if(assetsData) setAssets(assetsData);

            const { data: maintData, error: maintError } = await supabase.from('maintenance_records').select('*');
            if(maintError) addToast(`Erro ao carregar manutenções: ${maintError.message}`, 'error');
            else if(maintData) setMaintenanceRecords(maintData as unknown as MaintenanceRecord[]);
        };
        fetchData();

        const channel = supabase.channel('assets-db-changes');
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, (payload) => {
            if (payload.eventType === 'INSERT') setAssets(current => {
                if (current.some(item => item.id === payload.new.id)) return current;
                return [...current, payload.new as Asset]
            });
            if (payload.eventType === 'UPDATE') setAssets(current => current.map(a => a.id === payload.new.id ? payload.new as Asset : a));
            if (payload.eventType === 'DELETE') setAssets(current => current.filter(a => a.id !== (payload.old as Asset).id));
        }).on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_records' }, (payload) => {
            if (payload.eventType === 'INSERT') setMaintenanceRecords(current => {
                if (current.some(item => item.id === payload.new.id)) return current;
                return [...current, payload.new as MaintenanceRecord]
            });
            if (payload.eventType === 'UPDATE') setMaintenanceRecords(current => current.map(m => m.id === payload.new.id ? payload.new as MaintenanceRecord : m));
            if (payload.eventType === 'DELETE') setMaintenanceRecords(current => current.filter(m => m.id !== (payload.old as MaintenanceRecord).id));
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [supabase, addToast]);

    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [currentAsset, setCurrentAsset] = useState<Partial<Asset> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig<Asset> | null>(null);
    
    const filteredAssets = useMemo(() => {
        return assets.filter(a =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.location.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [assets, searchTerm]);
    
    const requestSort = (key: keyof Asset) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const handleScan = (data: string) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'asset' && parsed.id) {
                setSearchTerm(parsed.id);
                addToast(`Ativo ${parsed.id} localizado!`, 'success');
            } else {
                addToast('QR Code inválido. Este não parece ser um QR Code de ativo.', 'error');
            }
        } catch (e) {
            addToast('Erro ao ler o QR Code. O formato é inválido.', 'error');
            console.error("QR Code parse error:", e);
        }
        setIsScannerOpen(false);
    };

    const sortedAssets = useMemo(() => {
        let sortableItems = [...filteredAssets];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key;
                const valA = a[key];
                const valB = b[key];

                if (key === 'value') {
                    if (valA! < valB!) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA! > valB!) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }

                if (key === 'acquisition_date') {
                    const dateA = new Date(valA as string).getTime();
                    const dateB = new Date(valB as string).getTime();
                    if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
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
    }, [filteredAssets, sortConfig]);

    const openAssetModal = (asset: Asset | null = null) => {
        setCurrentAsset(asset ? {...asset} : { name: '', description: '', value: 0, location: '', acquisition_date: new Date().toISOString().split('T')[0] });
        setIsAssetModalOpen(true);
    };

    const closeAssetModal = () => {
        setCurrentAsset(null);
        setIsAssetModalOpen(false);
    };

    const openMaintenanceModal = (asset: Asset) => {
        setCurrentAsset(asset);
        setIsMaintenanceModalOpen(true);
    };
    
    const closeMaintenanceModal = () => {
        setIsMaintenanceModalOpen(false);
    }
    
    const openQrModal = (asset: Asset) => {
        setCurrentAsset(asset);
        setIsQrModalOpen(true);
    }
    
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setCurrentAsset(prev => prev ? ({ ...prev, photo: reader.result as string }) : null);
          };
          reader.readAsDataURL(file);
        }
    };
  
    const handleCameraCapture = (imageData: string) => {
      setCurrentAsset(prev => prev ? ({ ...prev, photo: imageData }) : null);
      setIsCameraModalOpen(false);
    };


    const handleAssetSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const assetData = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
            value: parseFloat(formData.get('value') as string),
            location: formData.get('location') as string,
            acquisition_date: formData.get('acquisition_date') as string,
            photo: currentAsset?.photo,
        };

        if (currentAsset?.id) {
            const originalAssets = assets;
            setAssets(prev => prev.map(a => a.id === currentAsset!.id ? { ...a, ...assetData } : a));
            const { error } = await supabase.from('assets').update(assetData).eq('id', currentAsset.id);
            if(error) {
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                setAssets(originalAssets); // Revert on error
            } else {
                addToast('Ativo atualizado com sucesso!', 'success');
                addActivityLog(`atualizou o ativo: ${assetData.name}.`);
            }
        } else {
            const { data, error } = await supabase.from('assets').insert(assetData).select().single();
            if(error) {
                addToast(`Erro ao criar: ${error.message}`, 'error');
            } else if (data) {
                setAssets(prev => [...prev, data]); // Manual update
                addToast('Ativo criado com sucesso!', 'success');
                addActivityLog(`criou o ativo: ${assetData.name}.`);
            }
        }
        closeAssetModal();
    };

    const handleDeleteAsset = (asset: Asset) => {
        showConfirmation('Deseja excluir este ativo? Suas manutenções também serão removidas.', async () => {
            const originalAssets = assets;
            const originalMaintenance = maintenanceRecords;
            setAssets(prev => prev.filter(a => a.id !== asset.id));
            setMaintenanceRecords(prev => prev.filter(m => m.asset_id !== asset.id));
            
            const { error: maintError } = await supabase.from('maintenance_records').delete().eq('asset_id', asset.id);
            if(maintError) {
                addToast(`Erro ao remover manutenções: ${maintError.message}`, 'error');
                setAssets(originalAssets);
                setMaintenanceRecords(originalMaintenance);
                return;
            }

            const { error: assetError } = await supabase.from('assets').delete().eq('id', asset.id);
            if(assetError) {
                addToast(`Erro ao excluir ativo: ${assetError.message}`, 'error');
                setAssets(originalAssets);
            } else {
                addToast('Ativo excluído com sucesso!', 'success');
                addActivityLog(`excluiu o ativo: ${asset.name}.`);
            }
        });
    };
    
    const handleMaintenanceSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentAsset || !currentAsset.id) return;

        const formData = new FormData(e.currentTarget);
        const newMaintenanceData = {
            asset_id: currentAsset.id,
            date: formData.get('maintenanceDate') as string,
            description: formData.get('maintenanceDescription') as string,
            cost: parseFloat(formData.get('maintenanceCost') as string),
            type: formData.get('maintenanceType') as 'completed' | 'scheduled',
        };

        const { data, error } = await supabase.from('maintenance_records').insert(newMaintenanceData).select().single();
        if (error) {
             addToast(`Erro ao adicionar manutenção: ${error.message}`, 'error');
        } else if (data) {
            setMaintenanceRecords(prev => [...prev, data as unknown as MaintenanceRecord]); // Manual update
            addToast('Registro de manutenção adicionado!', 'success');
            addActivityLog(`adicionou manutenção de R$${newMaintenanceData.cost} para o ativo: ${currentAsset.name}.`);
            e.currentTarget.reset();
        }
    };

    const assetColumns = [
        { header: 'Foto', accessor: (item: Asset) => (
            item.photo ? <img src={item.photo} alt={item.name} className="w-16 h-16 object-cover rounded-md" /> : <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-xs text-gray-500">Sem foto</div>
        )},
        { header: 'Nome', accessor: 'name' as const, sortable: true },
        { header: 'Descrição', accessor: 'description' as const, sortable: true },
        { header: 'Localização', accessor: 'location' as const, sortable: true },
        { header: 'Data de Aquisição', accessor: 'acquisition_date' as const, sortable: true },
        { header: 'Valor', accessor: (item: Asset) => item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sortable: true, sortKey: 'value' as const },
    ];
    
    const currentMaintenanceRecords = useMemo(() => {
        if (!currentAsset || !currentAsset.id) return [];
        return maintenanceRecords
            .filter(m => m.asset_id === currentAsset!.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [maintenanceRecords, currentAsset]);

    const formInputClass = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-gray-50 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200";
    const formLabelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Controle Patrimonial</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie suas ferramentas e equipamentos.</p>
                </div>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => setIsScannerOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Escanear
                    </button>
                    <button onClick={() => openAssetModal()} className="bg-primary text-white px-4 py-2 rounded-lg shadow hover:bg-secondary transition">
                        Novo Ativo
                    </button>
                </div>
            </div>
            
            <div className="relative">
                <input
                    type="text"
                    placeholder="Buscar por nome, ID ou localização..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <Table<Asset>
                columns={assetColumns}
                data={sortedAssets}
                actions={(asset) => (
                    <>
                        <button onClick={() => openQrModal(asset)} title="Gerar QR Code" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V4a1 1 0 00-1-1H3zm2 2a1 1 0 100 2h-1a1 1 0 100 2h1a1 1 0 100-2h1a1 1 0 100-2H5zm7-2a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V4a1 1 0 00-1-1h-4zm2 2a1 1 0 100 2h-1a1 1 0 100 2h1a1 1 0 100-2h1a1 1 0 100-2h-1zM3 12a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1H3zm2 2a1 1 0 100 2H4a1 1 0 100 2h1a1 1 0 100-2H5zm10-3a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button onClick={() => openMaintenanceModal(asset)} title="Manutenções" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button onClick={() => openAssetModal(asset)} title="Editar" className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onClick={() => handleDeleteAsset(asset)} title="Excluir" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </>
                )}
                sortConfig={sortConfig}
                requestSort={requestSort}
            />
            
            <Modal isOpen={isAssetModalOpen} onClose={closeAssetModal} title={currentAsset?.id ? 'Editar Ativo' : 'Novo Ativo'}>
                <form onSubmit={handleAssetSubmit} className="space-y-4">
                    <input type="hidden" name="id" defaultValue={currentAsset?.id} />
                    <div>
                        <label htmlFor="name" className={formLabelClass}>Nome do Ativo</label>
                        <input type="text" name="name" id="name" defaultValue={currentAsset?.name} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="description" className={formLabelClass}>Descrição</label>
                        <textarea name="description" id="description" defaultValue={currentAsset?.description} className={formInputClass}/>
                    </div>
                     <div>
                        <label htmlFor="value" className={formLabelClass}>Valor (R$)</label>
                        <input type="number" step="0.01" name="value" id="value" defaultValue={currentAsset?.value} required className={formInputClass}/>
                    </div>
                     <div>
                        <label htmlFor="location" className={formLabelClass}>Localização</label>
                        <input type="text" name="location" id="location" defaultValue={currentAsset?.location} required className={formInputClass}/>
                    </div>
                    <div>
                        <label htmlFor="acquisition_date" className={formLabelClass}>Data de Aquisição</label>
                        <input type="date" name="acquisition_date" id="acquisition_date" defaultValue={currentAsset?.acquisition_date} required className={formInputClass}/>
                    </div>
                     <div>
                        <label className={formLabelClass}>Foto do Ativo</label>
                        <div className="mt-1 flex items-center space-x-4">
                            {currentAsset?.photo && <img src={currentAsset.photo} alt="Preview" className="w-20 h-20 object-cover rounded-md" />}
                            <div className="flex items-center space-x-2">
                                <input type="file" id="asset-photo-upload" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
                                <label htmlFor="asset-photo-upload" className="cursor-pointer bg-white dark:bg-gray-700 text-sm text-primary dark:text-accent font-semibold py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                                  Escolher ficheiro
                                </label>
                                <button type="button" onClick={() => setIsCameraModalOpen(true)} className="p-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H12a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M15 9a3 3 0 10-6 0 3 3 0 006 0z" /></svg>
                                </button>
                            </div>
                        </div>
                      </div>
                    <div className="flex justify-end pt-4 space-x-2">
                        <button type="button" onClick={closeAssetModal} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary">Salvar</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isMaintenanceModalOpen} onClose={closeMaintenanceModal} title={`Manutenções de ${currentAsset?.name}`}>
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Nova Manutenção</h4>
                    <form onSubmit={handleMaintenanceSubmit} className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
                         <div>
                            <label htmlFor="maintenanceDate" className={formLabelClass}>Data</label>
                            <input type="date" name="maintenanceDate" id="maintenanceDate" required className={`${formInputClass} bg-white dark:bg-gray-700`}/>
                        </div>
                        <div>
                            <label htmlFor="maintenanceDescription" className={formLabelClass}>Descrição</label>
                            <input type="text" name="maintenanceDescription" id="maintenanceDescription" required className={`${formInputClass} bg-white dark:bg-gray-700`}/>
                        </div>
                        <div>
                            <label htmlFor="maintenanceCost" className={formLabelClass}>Custo da Manutenção (R$)</label>
                            <input type="number" step="0.01" name="maintenanceCost" id="maintenanceCost" required className={`${formInputClass} bg-white dark:bg-gray-700`}/>
                        </div>
                        <div>
                            <label htmlFor="maintenanceType" className={formLabelClass}>Tipo</label>
                            <select name="maintenanceType" id="maintenanceType" required className={`${formInputClass} bg-white dark:bg-gray-700`}>
                                <option value="completed">Realizada</option>
                                <option value="scheduled">Agendada</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 w-full">Adicionar Registro</button>
                    </form>
                    
                    <h4 className="font-semibold border-t dark:border-gray-700 pt-4 text-gray-800 dark:text-gray-200">Histórico de Manutenções</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {currentMaintenanceRecords.length > 0 ? currentMaintenanceRecords.map(m => (
                            <div key={m.id} className="p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                                <p className="font-bold text-gray-800 dark:text-gray-200">{new Date(m.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} - {m.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{m.description} ({m.type === 'completed' ? 'Realizada' : 'Agendada'})</p>
                            </div>
                        )) : <p className="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum registro de manutenção encontrado.</p>}
                    </div>
                </div>
            </Modal>
             {currentAsset && currentAsset.id && <QRCodeModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title={`QR Code para ${currentAsset.name}`} data={JSON.stringify({ type: 'asset', id: currentAsset.id })} />}
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
