
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
      setError('Both URL and Key are required.');
      return;
    }
    setError('');
    localStorage.setItem('supabaseUrl', url);
    localStorage.setItem('supabaseKey', key);
    // Invoke callback to update parent state immediately, avoiding page reload race conditions
    onConfigured();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-2">Supabase Configuration</h1>
        <p className="text-center text-gray-400 mb-6">
          Please provide your Supabase project credentials to connect to the backend.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="supabaseUrl" className="block text-sm font-medium text-gray-300">
              Project URL
            </label>
            <input
              id="supabaseUrl"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://<your-project-ref>.supabase.co"
              required
              className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="supabaseKey" className="block text-sm font-medium text-gray-300">
              Anon (Public) Key
            </label>
            <input
              id="supabaseKey"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="ey..."
              required
              className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-secondary hover:bg-primary rounded-md font-semibold transition-colors"
          >
            Connect to Supabase
          </button>
        </form>
      </div>
    </div>
  );
};
