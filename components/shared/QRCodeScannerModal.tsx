
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { ToastMessage } from '../../types';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  addToast: (message: string, type: ToastMessage['type']) => void;
  formats?: Html5QrcodeSupportedFormats[];
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({ isOpen, onClose, onScan, addToast, formats }) => {
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-reader-region";

  useEffect(() => {
    if (isOpen) {
      const startScanner = async () => {
        setIsCameraReady(false);
        setError(null);

        try {
          // Pequeno delay para garantir que o elemento DOM do modal foi renderizado
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const html5QrCode = new Html5Qrcode(regionId);
          scannerRef.current = html5QrCode;

          const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          };

          const onScanSuccess = (decodedText: string) => {
            onScan(decodedText);
            stopScanner().then(() => onClose());
          };

          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            onScanSuccess,
            undefined // Ignore failures to keep scanning
          );

          setIsCameraReady(true);
        } catch (err: any) {
          console.error("Scanner error:", err);
          let msg = "Não foi possível acessar a câmera.";
          if (err?.name === "NotAllowedError") msg = "Permissão de câmera negada pelo usuário.";
          if (err?.name === "NotFoundError") msg = "Nenhuma câmera encontrada no dispositivo.";
          setError(msg);
        }
      };

      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escanear Código">
      <div className="space-y-4">
        {error ? (
          <div className="p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md text-center">
            <p className="font-medium">{error}</p>
            <p className="text-xs mt-2 opacity-70 text-red-600 dark:text-red-400">Certifique-se de que o site está usando HTTPS e as permissões foram concedidas.</p>
            <button onClick={onClose} className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition">Fechar</button>
          </div>
        ) : (
          <div className="bg-black rounded-md overflow-hidden border-4 border-gray-300 dark:border-gray-600 relative min-h-[300px]">
            {/* O ID aqui é vital para o html5-qrcode injetar o vídeo */}
            <div id={regionId} className="w-full h-full"></div>
            
            {!isCameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
                <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-400 mt-4 text-sm font-medium">Iniciando câmera segura...</p>
              </div>
            )}
            
            {isCameraReady && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-64 h-64 border-2 border-primary border-dashed rounded-lg opacity-40 animate-pulse"></div>
                    <p className="absolute bottom-4 text-white text-[10px] uppercase font-bold bg-primary/60 px-3 py-1 rounded-full">Alinhe o código na mira</p>
                </div>
            )}
          </div>
        )}
      </div>
      
      {/* Estilos para limpar o UI padrão do html5-qrcode caso ele apareça */}
      <style>{`
        #qr-reader-region video {
            width: 100% !important;
            height: auto !important;
            border-radius: 4px;
            object-fit: cover;
        }
        #qr-reader-region {
            border: none !important;
        }
        #qr-reader-region img {
            display: none !important;
        }
      `}</style>
    </Modal>
  );
};
