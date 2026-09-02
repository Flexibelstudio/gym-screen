/**
 * LETAR EFTER NYA VERSIONER VID START
 *
 * Appen sparar sitt bygge lokalt via en service worker. Problemet har varit att
 * den aldrig frågat om det finns något nyare — därför kunde skärmen i studion
 * köra veckogammal kod trots att bygget för länge sedan låg ute, och en vanlig
 * omladdning hjälpte inte.
 *
 * Här frågar vi. Vi laddar aldrig om mitt i användning — det har ställt till
 * det förr. Men hittas en ny version under de allra första sekunderna av en
 * start, medan laddsidan står kvar, laddas sidan om en enda gång — så att en
 * start alltid betyder senaste versionen.
 */

export const startAppUpdateWatcher = (): void => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // VID START: alltid senaste versionen. Hittas ett nyare bygge under de
    // forsta sekunderna — medan laddsidan fortfarande star pa skarmen — gors
    // EN omladdning direkt. Aldrig senare: mitt i anvandning visas i stallet
    // en diskret rad (se App.tsx). Sparren ser till att det aldrig blir mer
    // an en omladdning per start.
    const startadVid = Date.now();
    try {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            try {
                if (Date.now() - startadVid > 8000) return;
                if (sessionStorage.getItem('smartstudio-omladdad-vid-start') === '1') return;
                sessionStorage.setItem('smartstudio-omladdad-vid-start', '1');
                window.location.reload();
            } catch { /* inget */ }
        });
    } catch { /* inget */ }

    navigator.serviceWorker.ready
        .then(registration => {
            const fragaEfterNyVersion = () => {
                registration.update().catch(() => { /* nätet kan vara nere, strunt i det */ });
            };

            fragaEfterNyVersion();

            // Skärmen som vaknar ur viloläge räknas som en start.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') fragaEfterNyVersion();
            });
        })
        .catch(() => { /* ingen service worker registrerad, inget att fråga */ });
};
