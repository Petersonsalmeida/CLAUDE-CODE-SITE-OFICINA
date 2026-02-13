
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { ToastMessage } from '../../types';

// Type definition for the BarcodeDetector API which might not be in default TS libs
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<any[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: BarcodeDetectorOptions): BarcodeDetector;
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector: BarcodeDetectorConstructor;
  }
}

interface QRCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  addToast: (message: string, type: ToastMessage['type']) => void;
  formats?: string[]; // Allow custom formats
}

export const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({ isOpen, onClose, onScan, addToast, formats }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Fix: useRef expects an argument if generic is not allowing undefined implicitly in some configs
  const animationFrameId = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  const tick = useCallback(async (detector: BarcodeDetector) => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          onScan(barcodes[0].rawValue);
          // Don't close immediately to allow consecutive scans if logic permits, 
          // but usually parent handles closing or debounce. 
          // For this modal, closing on first scan is safer UI.
          onClose(); 
        } else {
          animationFrameId.current = requestAnimationFrame(() => tick(detector));
        }
      } catch (err) {
        console.error('Detection error:', err);
        animationFrameId.current = requestAnimationFrame(() => tick(detector));
      }
    } else {
      animationFrameId.current = requestAnimationFrame(() => tick(detector));
    }
  }, [onScan, onClose]);

  useEffect(() => {
    if (isOpen) {
      const startScan = async () => {
        setError(null);
        setIsCameraReady(false);
        if (!('BarcodeDetector' in window)) {
          setError("Seu navegador não suporta a detecção de códigos. Tente usar o Chrome ou Edge em Android/Desktop ou Safari em iOS (com flags ativas).");
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              setIsCameraReady(true);
              // Default to common barcodes if no specific formats provided
              const scanFormats = formats || ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
              const detector = new window.BarcodeDetector({ formats: scanFormats });
              tick(detector);
            };
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
          setIsCameraReady(false);
        }
      };
      startScan();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera, tick, formats]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Escanear Código">
      <div className="space-y-4">
        {error ? (
          <div className="p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-md text-center">
            <p>{error}</p>
            <button onClick={onClose} className="mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">Fechar</button>
          </div>
        ) : (
          <div className="bg-black rounded-md overflow-hidden border-4 border-gray-300 dark:border-gray-600 relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-auto" muted></video>
            {!isCameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75">
                <svg className="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white mt-4">Iniciando câmera...</p>
              </div>
            )}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-32 border-4 border-dashed border-red-500 rounded-lg opacity-75"></div>
                <p className="absolute top-4 text-white font-bold bg-black/50 px-2 rounded">Aponte para o código de barras</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
