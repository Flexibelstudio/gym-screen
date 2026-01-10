
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

    // Construct a deep link or web URL that the phone will open.
    // In Dev/AI Studio environment, we point to the current window location with a query param.
    // In Production, this would point to the deployed PWA URL.
    const encodedPayload = btoa(JSON.stringify(payload));
    
    // Check if we are in a dev environment or AI Studio Preview
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://medlem.flexibel.app';
    const qrValue = `${baseUrl}/?log=${encodedPayload}`;

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

    // Fixed position (Overlay mode)
    const bottomClass = hasActiveCarousel ? 'bottom-[140px]' : 'bottom-6';

    return (
        <div 
            className={`fixed right-6 z-40 bg-white p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-3 transition-all duration-500 animate-fade-in ${bottomClass}`}
            style={{ width: '160px' }}
        >
            <div className="bg-white p-1 rounded-lg">
                <QRCode 
                    value={qrValue} 
                    size={128} 
                    fgColor="#000000" 
                    bgColor="#ffffff" 
                    level="L"
                />
            </div>
            <div className="text-center">
                <p className="text-black font-bold text-xs uppercase tracking-wider">Skanna för att logga</p>
                <p className="text-gray-500 text-[10px] font-mono mt-0.5">Starta appen</p>
            </div>
        </div>
    );
};
