
import React, { useState } from 'react';

interface SupabaseSetupProps {
  onConfigured: () => void;
}

export const SupabaseSetup: React.FC<SupabaseSetupProps> = ({ onConfigured }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      setError('A URL e a Chave são obrigatórias.');
      return;
    }
    
    try {
        new URL(url);
        setError('');
        // Salva como string JSON
        localStorage.setItem('supabaseUrl', JSON.stringify(url.trim()));
        localStorage.setItem('supabaseKey', JSON.stringify(key.trim()));
        onConfigured();
    } catch (err) {
        setError('URL inválida. Certifique-se de incluir http:// ou https://');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary/20 rounded-xl">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path></svg>
            </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Configuração do Supabase</h1>
        <p className="text-center text-gray-400 mb-6 text-sm">
          Insira as credenciais do seu projeto Supabase para conectar o banco de dados.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="supabaseUrl" className="block text-xs font-bold uppercase text-gray-500 mb-1">
              Project URL
            </label>
            <input
              id="supabaseUrl"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sua-ref.supabase.co"
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div>
            <label htmlFor="supabaseKey" className="block text-xs font-bold uppercase text-gray-500 mb-1">
              Anon (Public) Key
            </label>
            <input
              id="supabaseKey"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ey..."
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono text-sm"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-xs font-medium">
                {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-primary hover:bg-secondary rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
          >
            Conectar ao Supabase
          </button>
        </form>
        <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">StockSys Inteligente</p>
        </div>
      </div>
    </div>
  );
};
