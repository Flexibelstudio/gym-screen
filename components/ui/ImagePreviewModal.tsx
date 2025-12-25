
import React from 'react';

export const ImagePreviewModal: React.FC<{ imageUrl: string | null; onClose: () => void; }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] p-2 bg-gray-900 rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img src={imageUrl} alt="Exercise" className="max-w-full max-h-[85vh] object-contain rounded-md" />
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl shadow-lg border-2 border-black"
          aria-label="Stäng bildvisning"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
