
import { ParsedNFe, NFeProduct } from '../types';

export const parseNFeXML = (xmlString: string): Promise<ParsedNFe> => {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, "application/xml");

      const errorNode = xmlDoc.querySelector("parsererror");
      if (errorNode) {
        reject(new Error("Erro ao analisar o XML. Verifique o formato do arquivo."));
        return;
      }

      const emitNode = xmlDoc.querySelector("emit");
      if (!emitNode) {
        reject(new Error("Não foi possível encontrar os dados do emissor (fornecedor) na NF-e."));
        return;
      }
      
      const supplier = {
        cnpj: emitNode.querySelector("CNPJ")?.textContent || '',
        name: emitNode.querySelector("xNome")?.textContent || '',
      };

      if (!supplier.cnpj || !supplier.name) {
          reject(new Error("CNPJ ou Nome do fornecedor não encontrado no XML."));
          return;
      }

      const productNodes = xmlDoc.querySelectorAll("det");
      if (productNodes.length === 0) {
        reject(new Error("Nenhum produto encontrado na NF-e."));
        return;
      }

      const products: NFeProduct[] = Array.from(productNodes).map(node => {
        const prodNode = node.querySelector("prod");
        if (!prodNode) {
          throw new Error("Formato de produto inválido em um dos itens.");
        }
        return {
          code: prodNode.querySelector("cProd")?.textContent || '',
          name: prodNode.querySelector("xProd")?.textContent || '',
          quantity: parseFloat(prodNode.querySelector("qCom")?.textContent || '0'),
          // Fix: Changed property name from unitPrice to unit_price to match NFeProduct type.
          unit_price: parseFloat(prodNode.querySelector("vUnCom")?.textContent || '0'),
        };
      });

      resolve({ supplier, products });

    } catch (error) {
      reject(new Error(`Falha ao processar o arquivo XML: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
};
