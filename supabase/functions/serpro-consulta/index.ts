
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

// Declare Deno for environments where Deno types are not automatically included
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { cpf } = await req.json()
    if (!cpf) throw new Error('CPF é obrigatório')

    // Retrieve API keys from Supabase Secrets
    const consumerKey = Deno.env.get('SERPRO_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('SERPRO_CONSUMER_SECRET')

    if (!consumerKey || !consumerSecret) {
      throw new Error('Chaves do SERPRO não configuradas no servidor (Secrets). Rode "npx supabase secrets set ..."')
    }

    // 1. Obter Token de Acesso (OAuth2 Client Credentials)
    const authString = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenResponse = await fetch('https://gateway.apiserpro.serpro.gov.br/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
      console.error('Erro Auth Serpro:', tokenData)
      throw new Error('Falha na autenticação com SERPRO. Verifique se as chaves (Consumer Key/Secret) estão corretas.')
    }

    // 2. Consultar CPF
    // ATUALIZADO PARA V2 (Retorna endereço completo)
    const consultaUrl = `https://gateway.apiserpro.serpro.gov.br/consulta-cpf-df/v2/cpf/${cpf}`
    
    const consultaResponse = await fetch(consultaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    })

    if (!consultaResponse.ok) {
        // Tenta ler o erro retornado pelo Serpro
        const errorText = await consultaResponse.text();
        console.error('Erro API Serpro:', errorText);
        
        let msg = `Erro na API SERPRO (${consultaResponse.status})`;
        if (consultaResponse.status === 404) {
             msg = 'CPF não encontrado na base do SERPRO.';
        } else if (consultaResponse.status === 401 || consultaResponse.status === 403) {
             msg = 'Erro de Permissão: Verifique se as chaves (Keys) configuradas no Supabase pertencem ao contrato V2.';
        }

        // Return 200 with error field so client can read it
        return new Response(JSON.stringify({ error: msg }), {
             headers: { ...corsHeaders, 'Content-Type': 'application/json' },
             status: 200 
        });
    }

    const dados = await consultaResponse.json()

    // Retorna os dados para o frontend
    return new Response(JSON.stringify(dados), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      // Return 200 to allow client to read the error message in 'data'
      status: 200,
    })
  }
})
