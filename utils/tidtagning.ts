// Enkel tidtagning: de senaste 20 matningarna sparas lokalt pa enheten
// (nyckeln 'smartstudio-tidtagning') och skrivs aven i konsolen som [tid].
// Sa far vi svart pa vitt var sekunderna bor, pa varje enhet for sig.
export const bokforTid = (namn: string, ms: number): void => {
    const rad = new Date().toTimeString().slice(0, 8) + ' ' + namn + ' ' + Math.round(ms) + 'ms';
    try {
        const nyckel = 'smartstudio-tidtagning';
        const lista: string[] = JSON.parse(localStorage.getItem(nyckel) || '[]');
        lista.push(rad);
        while (lista.length > 20) lista.shift();
        localStorage.setItem(nyckel, JSON.stringify(lista));
    } catch { /* fullt forrad stoppar inget */ }
    try { console.log('[tid]', rad); } catch { /* inget */ }
};
