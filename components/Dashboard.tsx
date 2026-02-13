
import React, { useState, useMemo, useEffect } from 'react';
import { Card } from './shared/Card';
import { Product, StockMovement, Asset } from '../types';
import { getStockAnalysis } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useSupabase } from '../contexts/SupabaseContext';


interface DashboardProps {}

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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                Assistente de IA
            </h3>
            <div className="space-y-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Pergunte algo sobre seu estoque..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    rows={2}
                />
                <div className="flex flex-wrap gap-2">
                    {quickPrompts.map(q => (
                        <button key={q} onClick={() => { setPrompt(q); handleAsk(q); }} className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full transition">
                            {q}
                        </button>
                    ))}
                </div>
                <button onClick={() => handleAsk()} disabled={isLoading} className="w-full bg-primary text-white py-2 rounded-md hover:bg-secondary disabled:bg-gray-400">
                    {isLoading ? 'Analisando...' : 'Consultar IA'}
                </button>
                {response && (
                    <div className={`mt-4 p-4 rounded-md border ${response.includes('CONFIGURAÇÃO') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}>
                        <p className="whitespace-pre-wrap">{response}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ProactiveAiCard: React.FC<{ products: Product[]; stockMovements: StockMovement[] }> = ({ products, stockMovements }) => {
    const [insight, setInsight] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const getInsight = async () => {
            if (products.length === 0) {
                setInsight('Adicione produtos para análise.');
                setIsLoading(false);
                return;
            }
            const analysis = await getStockAnalysis("Sugira compras urgentes baseadas no estoque mínimo.", products, stockMovements);
            setInsight(analysis);
            setIsLoading(false);
        };
        getInsight();
    }, [products, stockMovements]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Sugestões da IA</h3>
            <div className="max-h-40 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center text-gray-500">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Processando dados...
                    </div>
                ) : (
                    <p className={`text-sm ${insight.includes('CONFIGURAÇÃO') ? 'text-red-500 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>{insight}</p>
                )}
            </div>
        </div>
    );
};


export const Dashboard: React.FC<DashboardProps> = () => {
  const supabase = useSupabase();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const [productsRes, movementsRes, assetsRes] = await Promise.all([
            supabase.from('products').select('*'),
            supabase.from('stock_movements').select('*'),
            supabase.from('assets').select('*')
        ]);
        if (productsRes.data) setProducts(productsRes.data);
        if (movementsRes.data) setStockMovements(movementsRes.data as unknown as StockMovement[]);
        if (assetsRes.data) setAssets(assetsRes.data);
    };
    fetchData();
  }, [supabase]);

  const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0), [products]);
  const totalAssetsValue = useMemo(() => assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0), [assets]);
  const lowStockCount = useMemo(() => products.filter(p => (p.quantity || 0) < (p.min_stock || 0)).length, [products]);

  const topProductsData = useMemo(() => products.sort((a, b) => b.quantity - a.quantity).slice(0, 5).map(p => ({ name: p.name, quantidade: p.quantity })), [products]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Estoque Total" value={totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 14v1m0-1v-.01m-3.364-4.364l-.707-.707M17.07 9.929l-.707.707m-.707-.707l-.707.707m12.728 0l-.707-.707M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>} color="bg-green-500" />
        <Card title="Patrimônio" value={totalAssetsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>} color="bg-purple-500" />
        <Card title="Estoque Baixo" value={lowStockCount} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>} color="bg-yellow-500" />
        <ProactiveAiCard products={products} stockMovements={stockMovements} />
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Top 5 Produtos</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={topProductsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="quantidade" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
      </div>

      <AiAssistant products={products} stockMovements={stockMovements} />
    </div>
  );
};
