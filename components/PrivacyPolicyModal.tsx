import React from 'react';
import { Modal } from './ui/Modal';

export const PrivacyPolicyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Integritetspolicy" size="lg">
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p className="font-bold text-gray-900 dark:text-white text-base">Din integritet är viktig för oss.</p>
            <p>Denna policy beskriver hur vi hanterar dina personuppgifter i enlighet med GDPR.</p>
            
            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">Vilken data samlar vi in?</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>Namn och e-postadress för inloggning.</li>
                    <li>Profilbild (frivilligt).</li>
                    <li>Träningsdata (loggade pass, vikter, repetitioner, RPE).</li>
                    <li>Kroppskänsla och kommentarer kopplade till pass.</li>
                </ul>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">Varför behandlar vi din data?</h4>
                <p>Vi använder din data för att visa din träningshistorik, räkna ut streaks och progression. Din data skickas även i anonymiserad form till vår AI-motor (Google Gemini) för att kunna ge dig personliga träningstips och strategier.</p>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">Lagring och säkerhet</h4>
                <p>Datan lagras säkert i Google Firebase. Endast behörig personal på din anslutna studio och systemadministratörer har tillgång till din data för att kunna ge support och coachning.</p>
            </section>

            <section className="space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-wider">Dina rättigheter</h4>
                <p>Du har rätt att begära ett utdrag av din data, få felaktig data rättad eller begära att ditt konto och all tillhörande data raderas permanent.</p>
            </section>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400">SmartSkärm följer gällande lagstiftning för skydd av personuppgifter.</p>
            </div>
        </div>
    </Modal>
);