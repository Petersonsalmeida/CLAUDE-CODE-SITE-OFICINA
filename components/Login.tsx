
import React, { useState } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

export const Login: React.FC = () => {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    if (isRegistering) {
      // Store invite code temporarily for App.tsx to handle profile creation
      if(inviteCode.trim()) {
          localStorage.setItem('tempInviteCode', inviteCode.trim());
      } else {
          localStorage.removeItem('tempInviteCode');
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg('Cadastro realizado! Verifique seu email para confirmar (se necessário) ou faça login.');
        setIsRegistering(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans p-4">
      <div className="flex flex-col md:flex-row w-full max-w-6xl md:rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="w-full md:w-1/2 bg-neutral p-8 md:p-12 flex flex-col justify-center items-center relative min-h-[250px] md:min-h-0">
           <div 
             className="absolute inset-0 bg-cover bg-center opacity-40" 
             style={{ backgroundImage: "url('https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260')" }}
           ></div>
           <div className="relative z-10 text-center">
            <svg className="w-16 h-16 md:w-24 md:h-24 text-accent mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7l8 4"></path></svg>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter">
              Bem-vindo ao <span className="text-accent">StockSys</span>
            </h1>
            <p className="text-gray-300 mt-2 md:mt-4 text-base md:text-lg">
              Sua solução inteligente para controle de estoque.
            </p>
           </div>
        </div>

        <div className="w-full md:w-1/2 bg-gray-800 p-8 sm:p-12 flex flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold text-gray-100">{isRegistering ? 'Criar Conta' : 'Acessar Sistema'}</h2>
                  <button 
                    onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                    className="text-sm text-accent hover:text-blue-400 underline"
                  >
                    {isRegistering ? 'Já tenho conta' : 'Não tenho conta'}
                  </button>
              </div>
              <p className="text-gray-400 mb-8">{isRegistering ? 'Preencha os dados para começar.' : 'Faça login para continuar.'}</p>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">Senha</label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                      placeholder="********"
                    />
                  </div>
                </div>

                {isRegistering && (
                    <div>
                        <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300">
                            Código da Empresa <span className="text-gray-500 text-xs">(Opcional - Para funcionários)</span>
                        </label>
                        <div className="mt-1">
                            <input
                            id="inviteCode"
                            name="inviteCode"
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                            placeholder="Cole o código aqui se foi convidado"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Deixe em branco para criar uma Nova Empresa.</p>
                    </div>
                )}
                
                {error && <p className="text-sm text-red-400">{error}</p>}
                {successMsg && <p className="text-sm text-green-400">{successMsg}</p>}
                
                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-secondary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-secondary transition-colors duration-300 disabled:bg-gray-500"
                  >
                    {isLoading ? 'Processando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
                  </button>
                </div>
              </form>
          </div>
        </div>
      </div>
    </div>
  );
};