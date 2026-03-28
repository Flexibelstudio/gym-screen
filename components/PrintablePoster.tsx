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
    <div className="print-only w-full h-screen flex flex-col items-center justify-center bg-white text-black p-12 text-center" style={{ pageBreakAfter: 'always' }}>
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        <h2 className="text-2xl font-bold text-gray-500 mb-2 uppercase tracking-widest">{organizationName}</h2>
        <h1 className="text-5xl font-black mb-16 leading-tight uppercase">{title}</h1>
        
        <div className="bg-gray-50 p-12 rounded-[3rem] border-4 border-gray-100 flex flex-col items-center mb-16 shadow-2xl">
          <QRCodeSVG value={url} size={300} level="H" includeMargin={true} className="mb-8 rounded-xl" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.3em] mb-2">Din Inbjudningskod</p>
          <p className="text-7xl font-black font-mono tracking-[0.2em]">{code}</p>
        </div>

        <div className="text-left w-full max-w-2xl space-y-6">
          <h3 className="text-2xl font-black uppercase tracking-widest border-b-2 border-gray-200 pb-4 mb-6">Så här gör du:</h3>
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-xl flex-shrink-0">1</div>
            <p className="text-2xl font-medium leading-relaxed pt-1">Scanna QR-koden ovan med din mobilkamera, eller gå in på <span className="font-black">smartskarm.se</span> och ange koden <span className="font-black bg-gray-100 px-3 py-1 rounded-lg">{code}</span>.</p>
          </div>
          <div className="flex items-start gap-6">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black text-xl flex-shrink-0">2</div>
            <p className="text-2xl font-medium leading-relaxed pt-1">Klart! Lägg gärna till webbsidan på din hemskärm så att du lätt hittar tillbaka.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
