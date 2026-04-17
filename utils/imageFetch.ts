export const fetchImageAsBase64 = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
        const contentType = response.headers.get("content-type");
        if (contentType && !contentType.startsWith("image/")) throw new Error(`Not an image: ${contentType}`);
        
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.log('Direct fetch failed, trying proxies...', e);
        
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`
        ];

        for (const proxyUrl of proxies) {
            try {
                const response = await fetch(proxyUrl);
                if (!response.ok) continue;
                
                const contentType = response.headers.get("content-type");
                if (contentType && !contentType.startsWith("image/")) {
                    console.log(`Proxy ${proxyUrl} returned non-image: ${contentType}`);
                    continue; // Skip if proxy returned an HTML error page
                }

                const blob = await response.blob();
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (proxyError) {
                console.log(`Proxy ${proxyUrl} failed, trying next...`);
            }
        }
        
        throw new Error("Kunde inte analysera bilden. Det beror oftast på att en Ad-blocker blockerar nedladdningen av externa bilder, eller på grund av säkerhetsinställningar. Ladda upp bilden på nytt i din anteckning, då sparas den i ett nytt format som kringgår problemet!");
    }
};
