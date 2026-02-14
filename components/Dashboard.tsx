
import React, { useState, useMemo, useEffect } from 'react';
import { Card } from './shared/Card';
import { Product, StockMovement, Asset, Category, ActivityLog } from '../types';
import { getStockAnalysis } from '../services/geminiService';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
    Legend, ResponsiveContainer, PieChart, Pie, Cell,
    AreaChart, Area 
} from 'recharts';
import { useSupabase } from '../contexts/SupabaseContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const AiAssistant: React.FC<{ products: Product[]; stockMovements: StockMovement[] }> = ({ products, stockMovements }) => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAsk = async (currentPrompt = prompt) => {
        if (!currentPrompt.trim()) return;
        setIsLoading(true);
        setResponse('');
        try {
            const analysis = await getStockAnalysis(currentPrompt, products, stockMovements);
            setResponse(analysis);
        } catch (error) {
            setResponse('Erro ao conectar com o serviço de inteligência.');
        } finally {
            setIsLoading(false);
        }
    };

    const quickPrompts = [
        "Quais produtos estão com estoque baixo?",
        "Qual o valor total do meu estoque?",
        "Análise de consumo mensal",
    ];
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <div className="p-2 bg-primary/10 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                </div>
                Assistente de Inteligência Artificial
            </h3>
            <div className="space-y-4">
                <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ex: Qual categoria tem mais itens parados?"
                        className="w-full p-4 pr-12 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        rows={2}
                    />
                    <button 
                        onClick={() => handleAsk()} 
                        disabled={isLoading}
                        className="absolute right-3 bottom-3 p-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 transition-colors"
                    >
                        {isLoading ? (
                             <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                        )}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {quickPrompts.map(q => (
                        <button key={q} onClick={() => { setPrompt(q); handleAsk(q); }} className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-accent text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full transition-all">
                            {q}
                        </button>
                    ))}
                </div>
                {response && (
                    <div className={`mt-4 p-5 rounded-xl border leading-relaxed ${response.includes('ERRO') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-gray-700 dark:text-gray-200'}`}>
                        <div className="flex items-start">
                            <svg className="w-5 h-5 mr-3 text-primary mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"></path></svg>
                            <p className="whitespace-pre-wrap text-sm">{response}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const supabase = useSupabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const [productsRes, movementsRes, assetsRes, categoriesRes, activitiesRes] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('stock_movements').select('*').order('date', { ascending: false }),
            supabase.from('assets').select('*'),
            supabase.from('categories').select('*'),
            supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(5)
        ]);
        if (productsRes.data) setProducts(productsRes.data);
        if (movementsRes.data) setStockMovements(movementsRes.data as unknown as StockMovement[]);
        if (assetsRes.data) setAssets(assetsRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
        if (activitiesRes.data) setActivities(activitiesRes.data as unknown as ActivityLog[]);
    };
    fetchData();
  }, [supabase]);

  const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0), [products]);
  const totalAssetsValue = useMemo(() => assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0), [assets]);
  const lowStockProducts = useMemo(() => products.filter(p => (p.quantity || 0) < (p.min_stock || 0)).sort((a,b) => (a.quantity - a.min_stock!) - (b.quantity - b.min_stock!)), [products]);

  // Gráfico de Barras: Top 5 Produtos
  const topProductsData = useMemo(() => products.sort((a, b) => b.quantity - a.quantity).slice(0, 5).map(p => ({ name: p.name.split(' ')[0], quantidade: p.quantity })), [products]);

  // Gráfico de Pizza: Distribuição por Categoria
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
        const cat = categories.find(c => c.id === p.category_id)?.name || 'Sem Categoria';
        counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products, categories]);

  // Gráfico de Tendência: Movimentações nos últimos 15 dias
  const trendData = useMemo(() => {
      const last15Days = [...Array(15)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (14 - i));
          return d.toISOString().split('T')[0];
      });

      return last15Days.map(date => {
          const dayMoves = stockMovements.filter(m => m.date.startsWith(date));
          return {
              date: date.split('-').slice(1).reverse().join('/'),
              entradas: dayMoves.filter(m => m.type === 'in').reduce((acc, m) => acc + m.quantity, 0),
              saidas: dayMoves.filter(m => m.type === 'out').reduce((acc, m) => acc + m.quantity, 0),
          };
      });
  }, [stockMovements]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Resumo Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Valor em Estoque" value={totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 14v1m0-1v-.01m-3.364-4.364l-.707-.707M17.07 9.929l-.707.707m-.707-.707l-.707.707m12.728 0l-.707-.707M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>} color="bg-blue-600" />
        <Card title="Total Ativos" value={totalAssetsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>} color="bg-indigo-600" />
        <Card title="Itens Críticos" value={lowStockProducts.length} icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>} color="bg-amber-500" />
        <Card title="Total Itens" value={products.length} icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7l8 4"></path></svg>} color="bg-emerald-600" />
      </div>
      
      {/* Grid Central: Gráficos de Tendência e Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tendência de Movimentação */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6">Tendência de Movimentação (15 dias)</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <AreaChart data={trendData}>
                        <defs>
                            <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} tick={{fill: '#9ca3af'}} />
                        <YAxis axisLine={false} tickLine={false} fontSize={11} tick={{fill: '#9ca3af'}} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconType="circle" />
                        <Area type="monotone" dataKey="entradas" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={3} />
                        <Area type="monotone" dataKey="saidas" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" strokeWidth={3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          </div>

          {/* Distribuição por Categoria */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6 text-center">Mix de Categorias</h3>
            <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                {categoryData.slice(0, 4).map((entry, index) => (
                    <div key={entry.name} className="flex items-center text-xs text-gray-500">
                        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="truncate">{entry.name}</span>
                    </div>
                ))}
            </div>
          </div>
      </div>

      {/* Grid Inferior: Estoque Crítico e Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Produtos em Alerta */}
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Alertas de Reposição</h3>
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Prioridade: Qtd vs Mínimo</span>
                </div>
                <div className="overflow-hidden">
                    {lowStockProducts.length > 0 ? (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {lowStockProducts.slice(0, 5).map(p => (
                                <li key={p.id} className="py-3 flex justify-between items-center group">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mr-3">
                                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-primary transition-colors">{p.name}</p>
                                            <p className="text-[10px] text-gray-400">Cód: {p.id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-red-500">{p.quantity} <span className="text-[10px] text-gray-400 font-normal">un</span></p>
                                        <p className="text-[10px] text-gray-400">Mínimo: {p.min_stock}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-gray-400 text-sm italic">Parabéns! Nenhum item em nível crítico.</p>
                        </div>
                    )}
                </div>
           </div>

           {/* Log de Atividades Rápidas */}
           <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Atividades Recentes</h3>
                <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-700"></div>
                    <ul className="space-y-6">
                        {activities.map((act, i) => (
                            <li key={act.id} className="relative pl-10">
                                <div className={`absolute left-2.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 z-10 ${i === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                <div className="flex flex-col">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        <span className="font-bold">{act.user}</span> {act.action}
                                    </p>
                                    <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{new Date(act.timestamp).toLocaleTimeString('pt-BR')} - {new Date(act.timestamp).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
           </div>
      </div>

      {/* Assistente IA */}
      <AiAssistant products={products} stockMovements={stockMovements} />
    </div>
  );
};
