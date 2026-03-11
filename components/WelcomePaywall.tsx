import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface WelcomePaywallProps {
    onLogout: () => void;
    userData: any;
}

export const WelcomePaywall: React.FC<WelcomePaywallProps> = ({ onLogout, userData }) => {
    const [loading, setLoading] = useState(false);

    const handlePaySystemFee = async () => {
        setLoading(true);
        try {
            const response = await fetch('https://api-632314644342.us-central1.run.app/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userData.uid,
                    organizationId: userData.organizationId,
                    paymentType: 'system_fee'
                }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert("Kunde inte skapa betalningssession.");
            }
        } catch (error) {
            console.error("Betalningsfel:", error);
            alert("Ett fel uppstod vid kontakt med betalningsservern.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 shadow-2xl"
            >
                <div className="mb-8">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-4">Välkommen till Smart Skärm!</h1>
                    <p className="text-xl text-gray-400">
                        Ditt gym-konto är nu skapat. För att låsa upp admin-verktygen och börja konfigurera dina skärmar behöver du aktivera ditt medlemskap.
                    </p>
                </div>

                <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-gray-800 text-left space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">1</div>
                        <p className="text-gray-300">Engångsavgift för systemuppsättning: <strong>995 kr</strong></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">2</div>
                        <p className="text-gray-300">Obegränsat antal skärmar och medlemmar ingår.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 font-bold">3</div>
                        <p className="text-gray-300">Support och framtida uppdateringar ingår.</p>
                    </div>
                </div>

                <button
                    onClick={handlePaySystemFee}
                    disabled={loading}
                    className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-2xl text-xl transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-primary/20"
                >
                    {loading ? 'Laddar...' : 'AKTIVERA GYMMET (995 kr)'}
                </button>

                <button 
                    onClick={onLogout}
                    className="mt-8 text-gray-500 hover:text-white font-medium transition-colors"
                >
                    Logga ut och slutför senare
                </button>
            </motion.div>
        </div>
    );
};