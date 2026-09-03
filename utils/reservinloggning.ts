/**
 * RESERVVÄG FÖR INLOGGNING
 *
 * På gamla pekskärmar välter inloggningsbiblioteket EFTER att Googles server
 * godkänt inloggningen — anropsloggen visade signInWithPassword 200, och sedan
 * kraschar bibliotekets egen efterbearbetning och stämplas som nätverksfel.
 *
 * Samma skärmar har däremot hållit sig inloggade i över ett år: återställningen
 * av en sparad session vid varje start fungerar bevisligen. Så reservvägen gör
 * själv det biblioteket inte klarar: loggar in med det enkla anrop som ger 200,
 * lägger den godkända sessionen där biblioteket sparar sina, och laddar om.
 * Appen vaknar, hittar sessionen och är inne — via vägen som alltid fungerat.
 */

type ReservResultat = 'ok' | 'fel-uppgifter' | 'misslyckades';

export const reservLoggaIn = async (
    apiKey: string,
    email: string,
    password: string
): Promise<ReservResultat> => {
    let data: any = null;
    try {
        const svar = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
            { method: 'POST', body: JSON.stringify({ email, password, returnSecureToken: true }) }
        );
        data = await svar.json().catch(() => null);
        if (!svar.ok) {
            const orsak = String(data?.error?.message || '');
            if (orsak.indexOf('INVALID_LOGIN') !== -1 || orsak.indexOf('EMAIL_NOT_FOUND') !== -1
                || orsak.indexOf('INVALID_PASSWORD') !== -1 || orsak.indexOf('INVALID_EMAIL') !== -1) {
                return 'fel-uppgifter';
            }
            return 'misslyckades';
        }
    } catch {
        return 'misslyckades';
    }

    if (!data?.idToken || !data?.refreshToken || !data?.localId) return 'misslyckades';

    const nu = Date.now();
    const livslangdSek = parseInt(data.expiresIn, 10) || 3600;
    const adress = data.email || email;

    // Samma form som biblioteket självt sparar sina sessioner i.
    const session = {
        uid: data.localId,
        email: adress,
        emailVerified: false,
        displayName: data.displayName || null,
        isAnonymous: false,
        photoURL: null,
        providerData: [{
            providerId: 'password',
            uid: adress,
            displayName: data.displayName || null,
            email: adress,
            phoneNumber: null,
            photoURL: null
        }],
        stsTokenManager: {
            refreshToken: data.refreshToken,
            accessToken: data.idToken,
            expirationTime: nu + livslangdSek * 1000
        },
        createdAt: String(nu),
        lastLoginAt: String(nu),
        apiKey,
        appName: '[DEFAULT]'
    };

    const nyckel = `firebase:authUser:${apiKey}:[DEFAULT]`;

    // Både localStorage och IndexedDB — biblioteket läser den plats det hittar
    // först, och vilken det blir varierar mellan webbläsare.
    try { localStorage.setItem(nyckel, JSON.stringify(session)); } catch { /* fortsätt ändå */ }

    await new Promise<void>((klar) => {
        try {
            const oppning = indexedDB.open('firebaseLocalStorageDb', 1);
            oppning.onupgradeneeded = () => {
                try { oppning.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' }); } catch { /* finns redan */ }
            };
            oppning.onsuccess = () => {
                try {
                    const tx = oppning.result.transaction('firebaseLocalStorage', 'readwrite');
                    tx.objectStore('firebaseLocalStorage').put({ fbase_key: nyckel, value: session });
                    tx.oncomplete = () => { try { oppning.result.close(); } catch { /* redan stängd */ } klar(); };
                    tx.onerror = () => klar();
                } catch { klar(); }
            };
            oppning.onerror = () => klar();
            oppning.onblocked = () => klar();
        } catch { klar(); }
    });

    // Kom ihåg att den här enheten behöver reservvägen. Då tas den direkt
    // nästa gång, i stället för att först vänta ut det trasiga försöket.
    try { localStorage.setItem('smartstudio-reservinloggning', '1'); } catch { /* spelar ingen roll */ }

    // Stod enheten i skarmvyn fore utloggningen? Da ska den rakt tillbaka
    // dit — det ar sa en skarm ar tankt att sta. (Samma nyckel som
    // AuthContext anvander: 'ny-screen-impersonation'.)
    try {
        const minne = localStorage.getItem('smartstudio-skarmvy-minne');
        if (minne && !localStorage.getItem('ny-screen-impersonation')) {
            localStorage.setItem('ny-screen-impersonation', minne);
        }
    } catch { /* inget */ }

    return 'ok';
};
