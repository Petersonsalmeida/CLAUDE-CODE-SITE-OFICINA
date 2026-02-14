
import { GoogleGenAI, Type } from "@google/genai";
import { Product, StockMovement, ParsedNFe } from '../types';

/**
 * Service for Gemini AI integration.
 * Follows the latest @google/genai guidelines.
 */

export const getStockAnalysis = async (
  prompt: string,
  products: Product[],
  movements: StockMovement[]
): Promise<string> => {
  try {
    // CRITICAL: Use the environment variable directly.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const systemInstruction = `Você é um assistente especialista em análise de estoque.
    Analise os dados e responda de forma curta e direta em português.`;

    const simplifiedProducts = products.slice(0, 50).map(p => ({
        name: p.name,
        qty: p.quantity,
        min: p.min_stock
    }));

    // CRITICAL: Call generateContent directly with the model and prompt.
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

export const parseInvoicePDF = async (pdfBase64: string): Promise<ParsedNFe> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

        const prompt = "Extraia dados da NF-e anexa em JSON.";
        const pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } };

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
        console.error("Gemini Parsing Error:", error);
        throw error;
    }
};
