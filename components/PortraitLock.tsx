import React, { useEffect, useState } from 'react';

/**
 * Medlemsappen är byggd stående. Vrider man mobilen bryts kolumnerna i loggen
 * och knapparna hamnar utanför skärmen.
 *
 * Installerad på hemskärmen låser manifestet appen till stående läge — det
 * sköter webbläsaren själv. I en vanlig flik finns ingen sådan spärr: iOS
 * saknar helt möjligheten att låsa rotationen. Då är det ärligare att be om
 * att telefonen vrids tillbaka än att visa en trasig vy.
 *
 * Vi läser den fysiska orienteringen via screen.orientation.angle, inte
 * fönstrets proportioner. Ett uppfällt tangentbord gör annars en liten telefon
 * bredare än den är hög, och rutan hade dykt upp mitt i att någon skriver.
 */
const readIsLandscape = (): boolean => {
    if (typeof window === 'undefined') return false;

    const angle = (window.screen as any)?.orientation?.angle;
    if (typeof angle === 'number') return angle === 90 || angle === 270;

    // Äldre iOS: window.orientation finns kvar när screen.orientation saknas.
    const legacy = (window as any).orientation;
    if (typeof legacy === 'number') return legacy === 90 || legacy === -90;

    return false;
};

/** Bara telefoner. Surfplattor och datorer ska aldrig få rutan. */
const isPhone = (): boolean => {
    if (typeof window === 'undefined') return false;
    const shortestSide = Math.min(window.screen.width, window.screen.height);
    return shortestSide <= 500;
};

export const PortraitLock: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const update = () => setShowPrompt(isPhone() && readIsLandscape());
        update();

        const orientation = (window.screen as any)?.orientation;
        orientation?.addEventListener?.('change', update);
        window.addEventListener('orientationchange', update);
        window.addEventListener('resize', update);

        return () => {
            orientation?.removeEventListener?.('change', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('resize', update);
        };
    }, []);

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-[100000] bg-white dark:bg-black flex flex-col items-center justify-center text-center px-8">
            <div className="w-14 h-14 rounded-2xl border-4 border-gray-900 dark:border-white mb-5" />
            <p className="text-xl font-black text-gray-900 dark:text-white">
                Vrid tillbaka telefonen
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                SmartStudio är byggd för stående läge. Då syns hela passet utan att du
                behöver dra i sidled.
            </p>
        </div>
    );
};
