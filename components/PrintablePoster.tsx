import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PrintablePosterProps {
  title: string;
  code: string;
  url: string;
  organizationName: string;
}

export const PrintablePoster: React.FC<PrintablePosterProps> = ({ title, code, url, organizationName }) => {
  return (
    <div className="print-only w-full bg-white text-black p-8 text-center" style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', boxSizing: 'border-box', pageBreakInside: 'avoid' }}>
      <div className="max-w-3xl mx-auto flex flex-col items-center w-full h-full justify-start pt-4">
        <h2 className="text-lg font-bold text-gray-500 mb-1 uppercase tracking-widest">{organizationName}</h2>
        <h1 className="text-3xl sm:text-4xl font-black mb-6 leading-tight uppercase max-w-2xl">{title}</h1>
        
        <div className="bg-gray-50 p-6 rounded-[2rem] border-2 border-gray-100 flex flex-col items-center mb-8 shadow-xl w-full max-w-sm">
          <QRCodeSVG value={url} size={180} level="H" includeMargin={true} className="mb-4 rounded-xl" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-1">Din Inbjudningskod</p>
          <p className="text-5xl font-black font-mono tracking-[0.2em]">{code}</p>
        </div>

        <div className="text-left w-full max-w-xl space-y-4">
          <h3 className="text-lg font-black uppercase tracking-widest border-b-2 border-gray-200 pb-2 mb-3">Så här gör du:</h3>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-base flex-shrink-0 mt-1">1</div>
            <p className="text-lg font-medium leading-relaxed">Scanna QR-koden ovan med din mobilkamera, eller gå in på <span className="font-black">smartskarm.se</span> och ange koden <span className="font-black bg-gray-100 px-2 py-1 rounded-md">{code}</span>.</p>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-base flex-shrink-0 mt-1">2</div>
            <p className="text-lg font-medium leading-relaxed">Klart! Lägg gärna till webbsidan på din hemskärm så att du lätt hittar tillbaka.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
