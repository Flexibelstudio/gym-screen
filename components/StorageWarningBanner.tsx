import React, { useState, useEffect } from 'react';

/**
 * Varnar när sidan körs i en miljö där inloggningen inte kan sparas.
 *
 * Två signaler, båda krävs inte — en räcker:
 *  1. Lagringstest. Går det inte att skriva och läsa tillbaka i localStorage kan
 *     Firebase inte behålla sessionen.
 *  2. Inbyggd webbvisning. Många sådana TILLÅTER skrivning men slänger allt när vyn
 *     stängs, så lagringstestet ensamt räcker inte. Därför kompletteras det med en
 *     enkel kontroll av användaragenten.
 *
 * Banner visas bara vid positiv signal. Är vi osäkra visar vi ingenting — en falsk
 * varning i en helt vanlig webbläsare vore värre än ingen varning alls.
 */
export const StorageWarningBanner: React.FC = () => {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const probe = async () => {
            let storageBroken = false;
            try {
                const key = '__ss_probe__';
                window.localStorage.setItem(key, '1');
                storageBroken = window.localStorage.getItem(key) !== '1';
                window.localStorage.removeItem(key);
            } catch {
                storageBroken = true;
            }

            // Firebase Auth sparar sessionen i IndexedDB, inte i localStorage.
            // I privat surfning och vissa webbvisningar fungerar localStorage medan
            // IndexedDB är blockerat — då räcker inte testet ovan.
            let idbBroken = false;
            try {
                idbBroken = await new Promise<boolean>((resolve) => {
                    if (!window.indexedDB) return resolve(true);
                    let settled = false;
                    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
                    // Vissa miljöer varken lyckas eller misslyckas — de bara tystnar.
                    const timer = setTimeout(() => done(true), 1500);
                    const req = window.indexedDB.open('__ss_probe_db__');
                    req.onerror = () => { clearTimeout(timer); done(true); };
                    req.onsuccess = () => {
                        clearTimeout(timer);
                        try { req.result.close(); window.indexedDB.deleteDatabase('__ss_probe_db__'); } catch {}
                        done(false);
                    };
                });
            } catch {
                idbBroken = true;
            }

            if (cancelled) return;

            const ua = navigator.userAgent || '';
            const isAndroidWebView = /\bwv\b/.test(ua);
            const isKnownInAppBrowser = /(FBAN|FBAV|Instagram|Line\/|Snapchat|Twitter|LinkedInApp)/i.test(ua);
            const isIOS = /iPhone|iPad|iPod/.test(ua);
            // På iOS innehåller Safari alltid "Safari" i strängen. Saknas den men enheten
            // är iOS körs vi i någon annan apps webbvisning.
            const isIOSWebView = isIOS && !/Safari/.test(ua);

            setShow(storageBroken || idbBroken || isAndroidWebView || isKnownInAppBrowser || isIOSWebView);
        };

        probe();
        return () => { cancelled = true; };
    }, []);

    if (!show) return null;

    const appUrl = window.location.origin;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(appUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-gray-900 px-4 py-3 shadow-lg">
            <div className="max-w-2xl mx-auto">
                <p className="text-sm font-bold mb-1">Inloggningen kan inte sparas här</p>
                <p className="text-sm leading-snug">
                    Du har öppnat sidan i en app som inte kommer ihåg att du är inloggad. Öppna
                    {' '}<span className="font-mono font-bold break-all">{appUrl}</span>{' '}
                    i Safari eller Chrome i stället.
                </p>
                <button
                    onClick={handleCopy}
                    className="mt-2 text-xs font-black uppercase tracking-wider bg-gray-900 text-amber-400 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                    {copied ? 'Länken kopierad' : 'Kopiera länken'}
                </button>
            </div>
        </div>
    );
};
