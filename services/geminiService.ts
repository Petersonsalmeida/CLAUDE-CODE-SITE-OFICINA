
import { GoogleGenAI, Type } from "@google/genai";
import { Product, StockMovement, ParsedNFe } from '../types';

/**
 * World-class senior frontend engineer implementation for Gemini API.
 * Adhering to strict coding guidelines:
 * 1. Initialize with named parameter { apiKey: process.env.API_KEY }.
 * 2. Use Gemini 3 series models for better reasoning and parsing.
 * 3. Access response text via the .text property.
 */

export const getStockAnalysis = async (
  prompt: string,
  products: Product[],
  movements: StockMovement[]
): Promise<string> => {
  // Use the mandatory initialization pattern
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use Gemini 3 for complex reasoning tasks
  const model = 'gemini-3-flash-preview';
  
  const systemInstruction = `Você é um assistente especialista em análise de estoque para uma oficina ou pequena indústria. Sua tarefa é analisar os dados de estoque e movimentações em formato JSON e responder à pergunta do usuário de forma clara, concisa e em português.
  - Dados de Produtos: Lista de produtos com ID, nome, quantidade atual, preço unitário e estoque mínimo.
  - Dados de Movimentações: Histórico de entradas e saídas.
  - Para perguntas de previsão (ex: "quando o produto X vai acabar?"), analise o histórico de saídas ('out') para calcular um consumo médio diário ou mensal e faça uma projeção. Deixe claro que é uma estimativa.
  - Forneça insights úteis, diretos e baseados nos dados fornecidos.`;

  const simplifiedProducts = products.slice(0, 50).map(p => ({
      name: p.name,
      qty: p.quantity,
      price: p.unit_price,
      min: p.min_stock
  }));

  const simplifiedMovements = movements
    .filter(m => new Date(m.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
    .slice(0, 20)
    .map(m => ({
        prod: m.product_name,
        type: m.type,
        qty: m.quantity,
        date: m.date ? m.date.split('T')[0] : 'N/A'
    }));

  const fullPrompt = `
    Aqui estão os dados atuais do estoque (resumidos):
    Produtos (Amostra):
    ${JSON.stringify(simplifiedProducts)}

    Movimentações de Estoque (Recentes):
    ${JSON.stringify(simplifiedMovements)}

    Pergunta do Usuário: "${prompt}"

    Sua análise:
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
          systemInstruction: systemInstruction,
          temperature: 0.5,
      }
    });

    return response.text || "A IA processou a solicitação mas não retornou texto.";
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    if (error.message?.includes("Failed to fetch")) {
        return "Erro de conexão: Não foi possível alcançar o serviço Gemini. Verifique sua internet.";
    }
    return `Erro ao consultar IA: ${error.message || "Falha na comunicação."}`;
  }
};

export const parseInvoicePDF = async (pdfBase64: string): Promise<ParsedNFe> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';

    const prompt = "Analise o documento PDF anexado (Nota Fiscal) e extraia os dados do fornecedor e os itens da nota.";
    
    const pdfPart = {
        inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
        },
    };

    try {
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
                            properties: {
                                name: { type: Type.STRING },
                                cnpj: { type: Type.STRING },
                            },
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

        if (!response.text) throw new Error("Resposta vazia do modelo.");
        return JSON.parse(response.text) as ParsedNFe;

    } catch (error: any) {
        console.error("Error parsing PDF invoice:", error);
        throw new Error(`Erro ao analisar PDF: ${error.message || "Falha na comunicação."}`);
    }
};
