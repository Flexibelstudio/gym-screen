
import React, { useState } from 'react';

interface TermsOfServiceModalProps {
    onAccept: () => Promise<void>;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({ onAccept }) => {
    const [isSaving, setIsSaving] = useState(false);

    const handleAccept = async () => {
        setIsSaving(true);
        try {
            await onAccept();
        } catch (e) {
            console.error("Failed to accept terms", e);
            alert("Kunde inte spara ditt godkännande. Försök igen.");
            setIsSaving(false);
        }
        // If successful, the modal will be unmounted by the parent component.
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-3xl text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]"
            >
                <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
                     <h2 className="text-2xl font-bold">Användarvillkor för SmartSkärm Organisationer</h2>
                </div>
                <div className="flex-grow overflow-y-auto p-6 prose prose-lg dark:prose-invert max-w-none">
                    <div className="not-prose bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 p-4 rounded-lg mb-6 text-yellow-800 dark:text-yellow-200">
                        <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100 mb-2">Viktig Information om Prenumeration</h3>
                        <p className="text-sm">
                            Genom att godkänna dessa villkor bekräftar du att din organisation startar en prenumeration för <strong>'Grundpaket (inkl. 1 skärm)'</strong> till en kostnad av <strong>995 kr/månad</strong> (exkl. moms).
                        </p>
                        <p className="text-sm mt-2">
                            Denna kostnad börjar gälla från och med {new Date().toLocaleDateString('sv-SE')} och kommer att faktureras enligt gällande betalningsrutiner.
                        </p>
                    </div>

                    <p className="text-sm text-gray-500">Senast uppdaterad: 2024-10-26</p>
                    <p>Välkommen som administratör för SmartSkärm! Genom att använda våra administrativa verktyg godkänner du ("Användaren", "du") följande villkor som reglerar din användning av tjänsten som tillhandahålls av oss ("Tjänsten", "vi").</p>
                    
                    <h3>1. Användarens Ansvar</h3>
                    <p><strong>Kontosäkerhet:</strong> Du är ansvarig för att hålla dina inloggningsuppgifter hemliga. Dela inte ditt lösenord med någon annan.</p>
                    <p><strong>Innehåll:</strong> Du är fullt ansvarig för allt innehåll som du eller dina coacher skapar och publicerar via plattformen, inklusive träningspass, övningar, bilder och informationstexter.</p>
                    <p><strong>Olämpligt material:</strong> Det är strängt förbjudet att ladda upp eller publicera innehåll som är olagligt, stötande, diskriminerande eller som gör intrång i någon annans immateriella rättigheter.</p>

                    <h3>2. Användning av AI-tjänster</h3>
                    <p><strong>Verktyg och Inspiration:</strong> Plattformens AI-funktioner (t.ex. "Passbyggaren") är avsedda som ett verktyg för att generera inspiration och utkast.</p>
                    <p><strong>Professionell Granskning:</strong> Allt AI-genererat innehåll, särskilt träningspass och övningar, måste granskas och vid behov anpassas av en kvalificerad coach eller instruktör innan det publiceras eller används med medlemmar. AI:n kan generera felaktig eller olämplig information.</p>
                    <p><strong>Ansvarsfulla Prompts:</strong> Du åtar dig att inte använda AI-funktionerna för att generera skadligt, olagligt eller oetiskt innehåll.</p>

                    <h3>3. Datahantering och Integritet</h3>
                    <p>Vi behandlar personuppgifter i enlighet med gällande dataskyddslagar (GDPR). Vår fullständiga integritetspolicy beskriver hur vi samlar in och använder data.</p>
                    <p>Som administratör har du tillgång till viss data om din organisation. Denna data får endast användas i enlighet med er organisations integritetspolicy och för att administrera Tjänsten.</p>

                    <h3>4. Immateriella Rättigheter</h3>
                    <p><strong>Tjänsten:</strong> Vi äger alla rättigheter till SmartSkärm-plattformen, dess kod, design och varumärke.</p>
                    <p><strong>Ditt Innehåll:</strong> Din organisation behåller äganderätten till det innehåll (träningspass, bilder etc.) som ni skapar. Ni ger oss dock en licens att visa och distribuera detta innehåll via Tjänsten så länge ni är kunder hos oss.</p>

                    <h3>5. Ansvarsfriskrivning</h3>
                    <p>Tjänsten tillhandahålls "i befintligt skick". Vi garanterar inte att den alltid kommer vara fri från fel eller avbrott.</p>
                    <p>Vi är inte ansvariga för några personskador eller andra skador som kan uppstå som ett resultat av att följa träningspass skapade eller distribuerade via plattformen. Det är alltid er organisations och era coachers ansvar att säkerställa att träningen utförs på ett säkert och korrekt sätt.</p>

                    <h3>6. Ändringar i Villkoren</h3>
                    <p>Vi förbehåller oss rätten att när som helst ändra dessa villkor. Vid väsentliga ändringar kommer vi att meddela dig, och du kan behöva godkänna de nya villkoren för att fortsätta använda de administrativa funktionerna.</p>
                </div>
                 <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button onClick={handleAccept} disabled={isSaving} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-8 rounded-lg disabled:opacity-50">
                        {isSaving ? 'Sparar...' : 'Godkänn och fortsätt'}
                    </button>
                </div>
            </div>
        </div>
    );
};