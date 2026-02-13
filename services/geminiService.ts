
import { GoogleGenAI, Type } from "@google/genai";
import { Product, StockMovement, ParsedNFe } from '../types';

/**
 * Verificador centralizado de API KEY.
 * Compatível com Netlify, Vercel e Local.
 */
const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key || key === 'undefined' || key === '' || key === 'null') {
    throw new Error("API_KEY_MISSING");
  }
  return key;
};

export const getStockAnalysis = async (
  prompt: string,
  products: Product[],
  movements: StockMovement[]
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3-flash-preview';
    
    const systemInstruction = `Você é um assistente especialista em análise de estoque.
    Analise os dados e responda de forma curta e direta em português.`;

    const simplifiedProducts = products.slice(0, 50).map(p => ({
        name: p.name,
        qty: p.quantity,
        min: p.min_stock
    }));

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: `Dados: ${JSON.stringify(simplifiedProducts)}. Pergunta: ${prompt}` }] }],
      config: {
          systemInstruction: systemInstruction,
          temperature: 0.4,
      }
    });

    return response.text || "Sem resposta da IA.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message === "API_KEY_MISSING") {
      return "ERRO NA VERCEL: A variável 'API_KEY' não foi configurada. No painel da Vercel, vá em Settings > Environment Variables e adicione a chave do Gemini.";
    }
    return `IA indisponível: ${error.message}`;
  }
};

export const parseInvoicePDF = async (pdfBase64: string): Promise<ParsedNFe> => {
    try {
        const apiKey = getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-3-flash-preview';

        const prompt = "Extraia dados da NF-e anexa em JSON.";
        const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }, pdfPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        supplier: {
                            type: Type.OBJECT,
                            properties: { name: { type: Type.STRING }, cnpj: { type: Type.STRING } },
                            required: ["name", "cnpj"]
                        },
                        products: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    code: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    quantity: { type: Type.NUMBER },
                                    unit_price: { type: Type.NUMBER },
                                },
                                required: ["code", "name", "quantity", "unit_price"]
                            }
                        }
                    },
                    required: ["supplier", "products"]
                }
            },
        });

        if (!response.text) throw new Error("Falha na extração.");
        return JSON.parse(response.text) as ParsedNFe;
    } catch (error: any) {
        if (error.message === "API_KEY_MISSING") {
            throw new Error("Migração Vercel pendente: Adicione a API_KEY nas variáveis de ambiente do projeto.");
        }
        throw error;
    }
};
