import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { WorkoutQRPayload } from '../types';
import { motion, AnimatePresence } from 'framer-motion'; // Om du har framer-motion, annars ta bort motion-taggarna

interface WorkoutQRDisplayProps {
    workoutId: string;
    organizationId: string;
    isEnabled: boolean;
    hasActiveCarousel: boolean;
    inline?: boolean;
    size?: number;
}

export const WorkoutQRDisplay: React.FC<WorkoutQRDisplayProps> = ({
    workoutId,
    organizationId,
    isEnabled,
    hasActiveCarousel,
    inline = false,
    size = 128
}) => {
    const [payload, setPayload] = useState<WorkoutQRPayload | null>(null);

    useEffect(() => {
        if (isEnabled && workoutId && organizationId) {
            setPayload({
                oid: organizationId,
                wid: workoutId,
                ts: Date.now()
            });
        } else {
            setPayload(null);
        }
    }, [isEnabled, workoutId, organizationId]);

    if (!isEnabled || !payload) {
        return null;
    }

    // Skapa URL
    const encodedPayload = btoa(JSON.stringify(payload));
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://medlem.flexibel.app';
    const qrValue = `${baseUrl}/?log=${encodedPayload}`;

    // --- INLINE MODE (För t.ex. inuti kort) ---
    if (inline) {
        return (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 inline-block">
                <div className="bg-white p-1 rounded-lg">
                    <QRCode 
                        value={qrValue} 
                        size={size} 
                        fgColor="#000000" 
                        bgColor="#ffffff" 
                        level="L"
                    />
                </div>
                <div className="text-center">
                    <p className="text-black font-black uppercase tracking-widest text-[10px]">Logga Pass</p>
                </div>
            </div>
        );
    }

    // --- FAB / OVERLAY MODE ---
    // Justerar positionen om informationskarusellen syns i botten
    const bottomPosition = hasActiveCarousel ? 'bottom-[140px]' : 'bottom-8';

    return (
        <div 
            className={`fixed right-8 z-[100] flex flex-col items-end transition-all duration-500 ease-in-out ${bottomPosition}`}
        >
            {/* Själva FAB-kortet */}
            <div className="bg-white/95 backdrop-blur-md p-4 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 flex flex-col items-center gap-3 animate-fade-in hover:scale-105 transition-transform duration-300">
                
                {/* QR-Koden */}
                <div className="bg-white p-2 rounded-2xl shadow-inner border border-gray-50">
                    <QRCode 
                        value={qrValue} 
                        size={120} // Något mindre för att vara smidig, men stor nog att scanna
                        fgColor="#000000" 
                        bgColor="#ffffff" 
                        level="L"
                    />
                </div>

                {/* Text / Etikett */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <p className="text-gray-900 font-black text-[10px] uppercase tracking-widest">
                            Logga Nu
                        </p>
                    </div>
                    <p className="text-gray-400 text-[9px] font-medium font-mono">
                        Öppna kameran
                    </p>
                </div>
            </div>
        </div>
    );
};