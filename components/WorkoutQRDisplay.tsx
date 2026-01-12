import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { WorkoutQRPayload } from '../types';

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

    // Construct the URL that the phone will open
    const encodedPayload = btoa(JSON.stringify(payload));
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://medlem.smartskarm.se';
    const qrValue = `${baseUrl}/?log=${encodedPayload}`;

    // Om den ska visas "inline" (t.ex. i en lista eller admin)
    if (inline) {
        return (
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-1 inline-block">
                <QRCode 
                    value={qrValue} 
                    size={size} 
                    fgColor="#000000" 
                    bgColor="#ffffff" 
                    level="L"
                />
                <div className="text-center">
                    <p className="text-black font-bold uppercase tracking-wider" style={{ fontSize: size > 80 ? '10px' : '8px' }}>Logga</p>
                </div>
            </div>
        );
    }

    // --- FLYTANDE FAB-LÄGE (Standard för passvyn) ---
    
    // Justera höjden om karusellen (info-bannern) visas längst ner (ca 512px hög på stora skärmar)
    const bottomPosition = hasActiveCarousel ? 'bottom-[540px]' : 'bottom-10';

    return (
        <div 
            className={`fixed right-10 z-[100] bg-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4 transition-all duration-700 ease-in-out animate-fade-in ${bottomPosition}`}
            style={{ width: '180px' }}
        >
            <div className="bg-white p-1 rounded-2xl">
                <QRCode 
                    value={qrValue} 
                    size={132} 
                    fgColor="#000000" 
                    bgColor="#ffffff" 
                    level="L"
                />
            </div>
            <div className="text-center space-y-1">
                <p className="text-black font-black text-[10px] uppercase tracking-[0.2em] leading-tight opacity-40">Skanna för att</p>
                <p className="text-primary font-black text-2xl uppercase tracking-tighter leading-none">LOGGA</p>
                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest pt-1">Starta appen</p>
            </div>
            
            {/* Dekorativt hörn för en snyggare look */}
            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl opacity-20"></div>
        </div>
    );
};