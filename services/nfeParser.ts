
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

      // Extrair Chave de Acesso (ID da tag infNFe)
      const infNFe = xmlDoc.querySelector("infNFe");
      const rawId = infNFe?.getAttribute("Id") || "";
      const access_key = rawId.replace("NFe", ""); // Remove o prefixo "NFe" para ficar só os 44 números

      if (!access_key || access_key.length !== 44) {
          reject(new Error("Não foi possível identificar uma chave de acesso válida (44 dígitos) neste XML."));
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

      // Valor Total da Nota
      const totalNode = xmlDoc.querySelector("total vNF");
      const total_value = parseFloat(totalNode?.textContent || '0');

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
          unit_price: parseFloat(prodNode.querySelector("vUnCom")?.textContent || '0'),
        };
      });

      resolve({ access_key, supplier, products, total_value });

    } catch (error) {
      reject(new Error(`Falha ao processar o arquivo XML: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
};
