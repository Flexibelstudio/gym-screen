import React from 'react';
import { Modal } from './ui/Modal';

export const UserTermsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Användarvillkor" size="lg">
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p className="font-bold text-gray-900 dark:text-white text-base">Välkommen till SmartSkärm!</p>
            <p>Genom att använda denna applikation och skapa ett konto godkänner du följande villkor:</p>
            
            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">1. Träning på egen risk</h4>
                <p>All träning sker på egen risk. SmartSkärm och din anslutna studio ansvarar inte för skador som uppstår i samband med utförandet av träningspass som visas eller loggas i appen.</p>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">2. AI-genererad rådgivning</h4>
                <p>Appens AI-coach ger förslag på vikter, strategier och övningar baserat på din historik. Detta är endast rådgivande information och ersätter inte medicinsk expertis eller professionell vägledning från en fysisk person. Lyssna alltid på din kropp.</p>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">3. Uppladdat innehåll</h4>
                <p>Du ansvarar för att profilbilder och kommentarer du lägger till är lämpliga och inte kränkande. Vi förbehåller oss rätten att ta bort material som bryter mot dessa regler.</p>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">4. Kontosäkerhet</h4>
                <p>Du är ansvarig för att skydda dina inloggningsuppgifter. Kontot är personligt och får inte delas med andra.</p>
            </section>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}</p>
            </div>
        </div>
    </Modal>
);