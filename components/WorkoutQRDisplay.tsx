import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { WorkoutQRPayload } from '../types';

interface WorkoutQRDisplayProps {
    workoutId: string;
    organizationId: string;
    isEnabled: boolean;
    hasActiveCarousel?: boolean;
    inline?: boolean;
    size?: number;
}

export const WorkoutQRDisplay: React.FC<WorkoutQRDisplayProps> = ({
    workoutId,
    organizationId,
    isEnabled,
    inline = false,
    size = 128
}) => {
    const [payload, setPayload] = useState<WorkoutQRPayload | null>(null);

    useEffect(() => {
        // Säkerställ att vi har både workoutId och organizationId innan vi skapar koden
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

    // 1. Skapa Base64-payload för själva loggningen
    const encodedPayload = btoa(JSON.stringify(payload));
    
    // 2. Definiera bas-URL (använder nuvarande domän eller fallback)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gym-screen.netlify.app';
    
    // 3. SKAPAR QR-VÄRDET: Vi lägger till invite-parametern så att LoginScreen kan läsa org-id direkt!
    const qrValue = `${baseUrl}/?log=${encodedPayload}&invite=${organizationId}`;

    const qrElement = (
        <QRCode 
            value={qrValue} 
            size={inline ? size : 110} 
            fgColor="#000000" 
            bgColor="#ffffff" 
            level="L"
        />
    );

    // Om den visas inline (t.ex. i admin-listor)
    if (inline) {
        return (
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-1 inline-block">
                {qrElement}
                <div className="text-center">
                    <p className="text-black font-bold uppercase tracking-wider" style={{ fontSize: size > 80 ? '10px' : '8px' }}>Logga</p>
                </div>
            </div>
        );
    }

    // Portal-lösning för studioskärmen (TV-läge)
    const portalContent = (
        <div 
            className="fixed bottom-10 right-10 z-[9999] bg-white p-4 rounded-[2rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] flex flex-col items-center gap-2 transition-all duration-500 animate-fade-in border border-gray-100"
            style={{ width: '150px' }}
        >
            <div className="bg-white p-1 rounded-xl">
                {qrElement}
            </div>
            <div className="text-center space-y-0">
                <p className="text-black font-black text-[9px] uppercase tracking-[0.2em] leading-tight opacity-40">Skanna för att</p>
                <p className="text-primary font-black text-xl uppercase tracking-tighter leading-none">LOGGA</p>
                <p className="text-gray-400 text-[8px] font-bold uppercase tracking-widest pt-1">Starta appen</p>
            </div>
            
            {/* Dekorativt hörn-element */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl opacity-20"></div>
        </div>
    );

    return createPortal(portalContent, document.body);
};