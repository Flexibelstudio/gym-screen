import React from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';

interface PrintablePosterProps {
  title: string;
  code: string;
  url: string;
  organizationName: string;
}

export const PrintablePoster: React.FC<PrintablePosterProps> = ({ title, code, url, organizationName }) => {
  const posterContent = (
    <div className="print-only w-full bg-white text-black flex flex-col items-center justify-start" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', boxSizing: 'border-box', pageBreakInside: 'avoid' }}>
      <div className="max-w-3xl mx-auto flex flex-col items-center w-full px-8 pt-12 pb-4">
        <h2 className="text-xl font-bold text-gray-500 mb-2 uppercase tracking-widest text-center">{organizationName}</h2>
        <h1 className="text-4xl sm:text-5xl font-black mb-8 leading-tight uppercase max-w-2xl text-center">{title}</h1>
        
        <div className="bg-gray-50 p-8 rounded-[3rem] border-4 border-gray-100 flex flex-col items-center mb-10 shadow-xl w-full max-w-md mx-auto">
          <QRCodeSVG value={url} size={220} level="H" includeMargin={true} className="mb-6 rounded-xl" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] mb-2 text-center">Din Inbjudningskod</p>
          <p className="text-6xl font-black font-mono tracking-[0.2em] text-center">{code}</p>
        </div>

        <div className="text-left w-full max-w-2xl space-y-5 mx-auto">
          <h3 className="text-2xl font-black uppercase tracking-widest border-b-2 border-gray-200 pb-3 mb-4">Så här gör du:</h3>
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-xl flex-shrink-0 mt-1">1</div>
            <p className="text-2xl font-medium leading-relaxed">Scanna QR-koden ovan med din mobilkamera, eller gå in på <span className="font-black">smartstudio.se</span> och ange koden <span className="font-black bg-gray-100 px-3 py-1 rounded-lg">{code}</span>.</p>
          </div>
          <div className="flex items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-xl flex-shrink-0 mt-1">2</div>
            <p className="text-2xl font-medium leading-relaxed">Klart! Lägg gärna till webbsidan på din hemskärm så att du lätt hittar tillbaka.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the poster directly into the body to avoid any layout interference from parent containers
  return createPortal(posterContent, document.body);
};
