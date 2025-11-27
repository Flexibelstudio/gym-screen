
import React, { useState, useRef } from 'react';
import { uploadImage } from '../../services/firebaseService';
import { resizeImage } from '../../utils/imageUtils';

export const AILoadingSpinner: React.FC = () => (
    <div className="relative w-8 h-8">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

export const InputField: React.FC<{label: string, value?: string, onChange: (val: string) => void, placeholder?: string, type?: string, required?: boolean}> = ({label, value, onChange, placeholder, type="text", required}) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            required={required}
            className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
        />
    </div>
);

export const TextareaField: React.FC<{label: string, value: string, onChange: (val: string) => void, placeholder?: string, rows?: number}> = ({label, value, onChange, placeholder, rows}) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || label} rows={rows} className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none" />
    </div>
);

export const SelectField: React.FC<{label: string, value: string, onChange: (val: string) => void, children: React.ReactNode}> = ({label, value, onChange, children}) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none">
            {children}
        </select>
    </div>
);

export const CheckboxField: React.FC<{label: string, checked: boolean, onChange: (checked: boolean) => void}> = ({label, checked, onChange}) => (
    <label className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-300 dark:hover:bg-gray-700/50 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-5 w-5 rounded text-primary focus:ring-primary" />
        <span className="text-gray-800 dark:text-white font-medium">{label}</span>
    </label>
);

export const ImageUploaderForBanner: React.FC<{
  imageUrl: string | null;
  onImageChange: (url: string) => void;
  disabled?: boolean;
  organizationId: string;
}> = ({ imageUrl, onImageChange, disabled, organizationId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (disabled || !file || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
        const resizedBase64Image = await resizeImage(file, 1280, 1280, 0.75);
        const path = `organizations/${organizationId}/content_images/${Date.now()}-${file.name}`;
        const downloadURL = await uploadImage(path, resizedBase64Image);
        onImageChange(downloadURL);
    } catch (error) {
        console.error("Image upload failed:", error);
        alert("Bilden kunde inte laddas upp. Försök med en annan bild.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); if(!disabled) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  if (imageUrl) {
    return (
      <div className="relative group w-full max-w-md">
        <img 
            src={imageUrl} 
            alt="Förhandsvisning" 
            className="w-full h-48 object-contain bg-gray-100 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700" 
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
          <button onClick={() => !disabled && onImageChange('')} disabled={disabled} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-full shadow-lg">
            Ta bort
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center p-4 w-full h-32 border-2 border-dashed rounded-lg transition-colors ${
        disabled ? 'cursor-not-allowed bg-gray-700/50' : 'cursor-pointer'
      } ${
        isDragging ? 'border-primary bg-primary/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
    >
      {isUploading && (
        <div className="absolute inset-0 bg-gray-900/80 rounded-md z-10 flex flex-col items-center justify-center gap-2">
            <AILoadingSpinner />
            <p className="text-sm font-semibold text-gray-300">Laddar upp...</p>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={(e) => handleFile(e.target.files?.[0] || null)} accept="image/*" className="hidden" disabled={disabled} />
      <div className="text-center text-gray-500 dark:text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        <p className="font-semibold mt-1 text-sm">Dra och släpp en bild</p>
        <p className="text-xs">eller klicka för att välja fil</p>
      </div>
    </div>
  );
};
