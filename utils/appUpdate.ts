/**
 * LETAR EFTER NYA VERSIONER VID START
 *
 * Appen sparar sitt bygge lokalt via en service worker. Problemet har varit att
 * den aldrig frågat om det finns något nyare — därför kunde skärmen i studion
 * köra veckogammal kod trots att bygget för länge sedan låg ute, och en vanlig
 * omladdning hjälpte inte.
 *
 * Här frågar vi. Inget mer. Vi laddar aldrig om av oss själva — det har ställt
 * till det förr. Hittas en ny version tas den i bruk nästa gång skärmen startas
 * eller laddas om, vilket är precis vad man förväntar sig.
 */

export const startAppUpdateWatcher = (): void => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

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
