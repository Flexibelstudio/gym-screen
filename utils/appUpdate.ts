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

    // ETT undantag fran "ladda aldrig om": alldeles i borjan av en start.
    // Hittas en nyare version medan laddsidan fortfarande star pa skarmen
    // gors EN omladdning direkt, sa att en start alltid ger senaste versionen
    // — i stallet for att nya bygget dyker upp forst vid starten darpa.
    // Aldrig mitt i anvandning: fonstret ar bara nagra sekunder, och en
    // sparr ser till att det aldrig kan bli mer an en omladdning per start.
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
