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
            setResponse('Ocorreu um erro ao obter la análise.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const quickPrompts = [
        "Quais produtos estão com estoque baixo?",
        "Qual o valor total do meu estoque?",
        "Qual produto teve mais saídas no último mês?",
        "Baseado no consumo, quando a LIXA P320 vai acabar?",
    ];
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mt-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                Assistente de IA Preditiva
            </h3>
            <div className="space-y-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Pergunte sobre seu estoque..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    rows={3}
                />
                <div className="flex flex-wrap gap-2">
                    {quickPrompts.map(q => (
                        <button key={q} onClick={() => { setPrompt(q); handleAsk(q); }} className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full transition">
                            {q}
                        </button>
                    ))}
                </div>
                <button onClick={() => handleAsk()} disabled={isLoading} className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-secondary disabled:bg-gray-400 transition-colors duration-300 flex items-center justify-center">
                    {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Analisando...
                        </>
                    ) : 'Perguntar ao Gemini'}
                </button>
                {response && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{response}</p>
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
                setInsight('Adicione produtos ao estoque para receber sugestões de compra.');
                setIsLoading(false);
                return;
            }
            try {
                const proactivePrompt = "Analise o estoque, o estoque mínimo e o histórico de consumo recente. Sugira uma lista de compras com até 3 itens e quantidades recomendadas para evitar falta de estoque. Seja breve e direto.";
                const analysis = await getStockAnalysis(proactivePrompt, products, stockMovements);
                setInsight(analysis);
            } catch (error) {
                setInsight('Não foi possível obter uma sugestão no momento.');
            } finally {
                setIsLoading(false);
            }
        };
        getInsight();
    }, [products, stockMovements]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Sugestões de Compra da IA</h3>
            <div className="max-h-40 overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Analisando dados...</span>
                    </div>
                ) : (
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{insight}</p>
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

    // No real-time needed for dashboard, fresh data on load is sufficient.
    // If real-time is desired, subscriptions can be added here.
  }, [supabase]);

  const totalStockValue = useMemo(() =>
    products.reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0),
    [products]
  );
  
  const totalAssetsValue = useMemo(() =>
    assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0),
    [assets]
  );
  
  const lowStockProducts = useMemo(() =>
    products.filter(p => (Number(p.quantity) || 0) < (p.min_stock || 10)).length,
    [products]
  );
  
  const totalItems = useMemo(() =>
    products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
    [products]
  );

  const topProductsChartData = useMemo(() =>
      products
        .sort((a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0))
        .slice(0, 5)
        .map(p => ({ name: p.name, quantidade: (Number(p.quantity) || 0) })),
      [products]
  );

  const abcAnalysisData = useMemo(() => {
    if (products.length === 0) return [];
    
    const sortedProducts = [...products]
        .map(p => ({...p, totalValue: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0)}))
        .sort((a, b) => b.totalValue - a.totalValue);
        
    const totalValue = sortedProducts.reduce((acc, p) => acc + p.totalValue, 0);
    
    if (totalValue === 0) return [];

    let cumulativePercentage = 0;
    const classifiedProducts = sortedProducts.map(p => {
        cumulativePercentage += (p.totalValue / totalValue) * 100;
        let classification = 'C';
        if (cumulativePercentage <= 80) {
            classification = 'A';
        } else if (cumulativePercentage <= 95) {
            classification = 'B';
        }
        return { ...p, classification };
    });

    const summary = [
        { name: 'Classe A (80%)', value: classifiedProducts.filter(p => p.classification === 'A').reduce((acc, p) => acc + p.totalValue, 0) },
        { name: 'Classe B (15%)', value: classifiedProducts.filter(p => p.classification === 'B').reduce((acc, p) => acc + p.totalValue, 0) },
        { name: 'Classe C (5%)', value: classifiedProducts.filter(p => p.classification === 'C').reduce((acc, p) => acc + p.totalValue, 0) },
    ];
    
    return summary.filter(s => s.value > 0);
  }, [products]);

  const COLORS = ['#1e40af', '#3b82f6', '#93c5fd'];
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, ...props }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const className = props.name.split(' ')[1]; // "A", "B", or "C"
  
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize="16">
        {className}
      </text>
    );
  };


  const iconClass = "w-8 h-8 text-white";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400">Visão geral do seu negócio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Card
          title="Valor Total do Estoque"
          value={totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 14v1m0-1v-.01m-3.364-4.364l-.707-.707M17.07 9.929l-.707.707m-.707-.707l-.707.707m12.728 0l-.707-.707M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>}
          color="bg-green-500"
        />
        <Card
          title="Valor do Patrimônio"
          value={totalAssetsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
          color="bg-purple-500"
        />
        <Card
          title="Itens em Estoque"
          value={totalItems}
          icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>}
          color="bg-blue-500"
        />
        <Card
          title="Produtos com Estoque Baixo"
          value={lowStockProducts}
          icon={<svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>}
          color="bg-yellow-500"
        />
        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <ProactiveAiCard products={products} stockMovements={stockMovements} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Top 5 Produtos por Quantidade</h3>
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={topProductsChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                        <XAxis dataKey="name" tick={{ fill: 'rgb(156 163 175)' }} fontSize={12} />
                        <YAxis tick={{ fill: 'rgb(156 163 175)' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', color: '#f9fafb', border: 'none', borderRadius: '0.5rem' }} />
                        <Legend wrapperStyle={{ color: '#9ca3af' }}/>
                        <Bar dataKey="quantidade" fill="#3b82f6" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
             <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Curva ABC por Valor de Estoque</h3>
             <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={abcAnalysisData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {abcAnalysisData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/>
                        <Legend wrapperStyle={{ color: '#9ca3af' }}/>
                    </PieChart>
                </ResponsiveContainer>
             </div>
        </div>
      </div>

      <AiAssistant products={products} stockMovements={stockMovements} />

    </div>
  );
};