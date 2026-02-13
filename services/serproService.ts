
import { SupabaseClient } from '@supabase/supabase-js';

export interface SerproData {
  nome: string;
  birthDate?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  situacaoCadastral?: string;
}

export const consultarCPF = async (cpf: string, supabase: SupabaseClient): Promise<SerproData> => {
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) {
    throw new Error("CPF inválido. Deve conter 11 dígitos.");
  }

  try {
    const { data, error } = await supabase.functions.invoke('serpro-consulta', {
      body: { cpf: cleanCPF }
    });

    if (error) {
      console.error("Erro na Edge Function:", error);
      
      // Clearer messaging for the common "Failed to fetch" error when function is not deployed
      if (error instanceof TypeError || error.message?.includes('Failed to fetch')) {
          throw new Error('Não foi possível conectar à função do servidor. Verifique se a Edge Function "serpro-consulta" foi publicada no seu projeto Supabase.');
      }
      
      throw new Error(`Erro na consulta: ${error.message || 'Desconhecido'}`);
    }

    if (!data || data.error) {
       throw new Error(data?.error || "O servidor não retornou dados válidos.");
    }

    // Process results
    let situacaoDescricao = 'DESCONHECIDO';
    if (data.situacao) {
        situacaoDescricao = typeof data.situacao === 'object' ? data.situacao.descricao : data.situacao;
    }

    let birthDate = undefined;
    const rawNasc = data.nascimento || data.dataNascimento;
    if (rawNasc) {
        const rawDate = String(rawNasc).replace(/\D/g, '');
        if (rawDate.length === 8) {
            const day = rawDate.substring(0, 2);
            const month = rawDate.substring(2, 4);
            const year = rawDate.substring(4);
            birthDate = `${year}-${month}-${day}`;
        }
    }

    const src = data.domicilio_fiscal || data.endereco || data;

    return {
      nome: data.nome || data.ni || "Nome não identificado",
      birthDate: birthDate,
      logradouro: src.logradouro || '',
      numero: src.numero || '',
      complemento: src.complemento || '',
      bairro: src.bairro || '',
      cidade: src.cidade || src.municipio || '',
      uf: src.uf || src.estado || '',
      cep: src.cep || '',
      situacaoCadastral: situacaoDescricao
    };

  } catch (err: any) {
    console.error("Falha na consulta SERPRO:", err);
    throw new Error(err.message || "Falha ao consultar base de dados externa.");
  }
};
