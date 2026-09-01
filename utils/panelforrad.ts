// Litet lokalt forrad for panelerna pa skarmen: det senast visade innehallet
// sparas undan och malas upp direkt vid nasta start, medan farsk data hamtas
// i bakgrunden och tyst skriver over.
export function lasPanel<T>(nyckel: string): T | null {
    try {
        const rad = localStorage.getItem(nyckel);
        return rad ? (JSON.parse(rad) as T) : null;
    } catch {
        return null;
    }
}

export function sparaPanel(nyckel: string, varde: unknown): void {
    try {
        localStorage.setItem(nyckel, JSON.stringify(varde));
    } catch { /* fullt forrad stoppar inget */ }
}
