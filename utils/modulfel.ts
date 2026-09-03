// NY VERSION MITT I ETT BESOK
//
// Appen laddas i delar. Varje bygge far nya filnamn, och nar en ny version
// lagts ut finns den gamla versionens delfiler inte kvar pa servern. Sitter
// nagon kvar pa den gamla sidan faller forsta klicket som behover en sadan
// del — servern svarar med startsidan i stallet for filen, och webblasaren
// sager "Failed to fetch dynamically imported module".
//
// Det ar inget fel i appen, bara en foraldrad flik. Ratt atgard ar att ladda
// om en gang. Har ligger igenkanningen och omladdningen, med en sparr sa att
// ett riktigt natfel aldrig kan bli en oandlig omladdningsloop.

const SPARR = 'smartstudio-modulomladdning';
const SPARRTID = 60 * 1000;

export const arModulfel = (fel: unknown): boolean => {
    const text = String((fel as any)?.message || fel || '');
    return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically/i.test(text)
        || /module script.*MIME type/i.test(text);
};

export const laddaOmForNyVersion = (): void => {
    try {
        const senast = Number(sessionStorage.getItem(SPARR) || 0);
        if (Date.now() - senast < SPARRTID) {
            // Vi har redan laddat om nyss. Da hjalper inte en till — lat
            // felsidan sta kvar sa att nagon kan se vad som hander.
            return;
        }
        sessionStorage.setItem(SPARR, String(Date.now()));
    } catch { /* utan forrad laddar vi om anda, en gang per sidvisning */ }

    // Ta bort den gamla versionens sparade filer forst, annars kan
    // webblasaren servera samma foraldrade startsida igen.
    const stad = (async () => {
        try {
            if ('caches' in window) {
                const nycklar = await caches.keys();
                await Promise.all(nycklar.map(n => caches.delete(n)));
            }
        } catch { /* inget */ }
        try {
            const reg = await navigator.serviceWorker?.getRegistration();
            if (reg) await reg.update();
        } catch { /* inget */ }
    })();

    // Vanta hogst en sekund pa stadningen — sedan laddar vi om oavsett.
    Promise.race([stad, new Promise(r => setTimeout(r, 1000))]).then(() => {
        window.location.reload();
    });
};

/**
 * Fangar samma fel utanfor React (t.ex. en delfil som laddas i bakgrunden).
 */
export const bevakaModulfel = (): void => {
    window.addEventListener('unhandledrejection', (e) => {
        if (arModulfel(e.reason)) {
            console.warn('[version] gammal delfil saknas — laddar om');
            laddaOmForNyVersion();
        }
    });
    window.addEventListener('error', (e) => {
        if (arModulfel((e as any).error || (e as any).message)) {
            console.warn('[version] gammal delfil saknas — laddar om');
            laddaOmForNyVersion();
        }
    });
};
