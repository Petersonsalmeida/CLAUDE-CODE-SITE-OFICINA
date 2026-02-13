import React from 'react';
import { Modal } from './Modal';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: string; // Data to be encoded in the QR code
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, title, data }) => {
  if (!isOpen) return null;

  // Using a free, public API to generate QR codes. No need for a library.
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-white rounded-lg">
          <img src={qrCodeUrl} alt="QR Code" width="250" height="250" />
        </div>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          Aponte a câmera do seu dispositivo para escanear o código.
        </p>
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 break-all">
          <strong>Dados:</strong> {data}
        </p>
      </div>
    </Modal>
  );
};
