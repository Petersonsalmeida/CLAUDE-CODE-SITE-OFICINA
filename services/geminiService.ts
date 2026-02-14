
import { GoogleGenAI, Type } from "@google/genai";
import { Product, StockMovement, ParsedNFe } from '../types';

/**
 * Service for Gemini AI integration.
 */

export const getStockAnalysis = async (
  prompt: string,
  products: Product[],
  movements: StockMovement[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const systemInstruction = `Você é um assistente especialista em análise de estoque.
    Analise os dados e responda de forma curta e direta em português.`;

    const simplifiedProducts = products.slice(0, 50).map(p => ({
        name: p.name,
        qty: p.quantity,
        min: p.min_stock
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: `Dados: ${JSON.stringify(simplifiedProducts)}. Pergunta: ${prompt}` }] }],
      config: {
          systemInstruction: systemInstruction,
          temperature: 0.4,
      }
    });

    return response.text || "Sem resposta da IA.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `IA indisponível: ${error.message}`;
  }
};

/**
 * Extrai dados de NF-e ou Cupom Fiscal a partir de PDF ou Imagem.
 */
export const parseFiscalDocument = async (base64Data: string, mimeType: string): Promise<ParsedNFe> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

        const prompt = `Analise este documento fiscal (pode ser uma NF-e ou um Cupom Fiscal/NFC-e).
        Extraia:
        1. Nome do Fornecedor (Razão Social).
        2. CNPJ do Fornecedor.
        3. Lista de produtos contendo: Código (se houver, senão use uma abreviação do nome), Nome legível, Quantidade e Preço Unitário.
        4. Valor total da nota.
        5. Chave de acesso (44 dígitos), se disponível.
        
        Retorne estritamente em JSON.`;

        const documentPart = { inlineData: { mimeType: mimeType, data: base64Data.split(',')[1] || base64Data } };

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ text: prompt }, documentPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        access_key: { type: Type.STRING },
                        supplier: {
                            type: Type.OBJECT,
                            properties: { name: { type: Type.STRING }, cnpj: { type: Type.STRING } },
                            required: ["name", "cnpj"]
                        },
                        total_value: { type: Type.NUMBER },
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
                    required: ["supplier", "products", "total_value"]
                }
            },
        });

        if (!response.text) throw new Error("A IA não conseguiu ler os dados do documento.");
        return JSON.parse(response.text) as ParsedNFe;
    } catch (error: any) {
        console.error("Gemini Parsing Error:", error);
        throw new Error(`Falha na análise da IA: ${error.message}`);
    }
};
