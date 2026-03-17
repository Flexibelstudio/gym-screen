import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface WelcomePaywallProps {
    onLogout: () => void;
    userData: any;
}

export const WelcomePaywall: React.FC<WelcomePaywallProps> = ({ onLogout, userData }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const handlePaySystemFee = async () => {
        if (!acceptedTerms) return;
        
        setLoading(true);
        setError(null);
        try {
            // Använder miljövariabeln istället för hårdkodad URL
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await fetch(`${apiUrl}/create-checkout-session`, {
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
                throw new Error("Ingen betalningslänk returnerades.");
            }
        } catch (err: any) {
            console.error("Betalningsfel:", err);
            setError(err.message || "Ett fel uppstod vid kontakt med betalningsservern.");
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
                    <h1 className="text-4xl font-black text-white mb-4 text-balance">Aktivera {userData?.organizationName || 'ditt gym'}</h1>
                    <p className="text-xl text-gray-400">
                        Välkommen som partner! För att låsa upp din licens och aktivera Smart Skärm i din verksamhet behöver du bekräfta ditt abonnemang.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-6 text-sm font-bold">
                        {error}
                    </div>
                )}

                <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-gray-800 text-left space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">1</div>
                        <p className="text-gray-300">Licensavgift: <strong>995 kr / månad</strong> (exkl. moms).</p>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">2</div>
                        <p className="text-gray-300">Licensen omfattar <strong>1 aktiv skärm</strong>.</p>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">3</div>
                        <p className="text-gray-300">Bindningstid <strong>12 månader</strong>. Löper vidare med 12 månader åt gången om inte uppsägning sker senast <strong>3 månader</strong> innan periodens slut.</p>
                    </div>
                </div>

                <div className="mb-8 p-5 bg-gray-800/30 rounded-xl border border-gray-700 hover:border-primary/50 transition-colors">
                    <label className="flex items-center gap-4 cursor-pointer group text-left">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="peer h-6 w-6 cursor-pointer appearance-none rounded border border-gray-600 bg-gray-700 checked:bg-primary checked:border-primary transition-all"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            <svg className="absolute top-1 left-1 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-sm text-gray-300 group-hover:text-white leading-snug">
                            Jag bekräftar beställningen av Smart Skärm och godkänner avtalsvillkoren om 12 månaders bindningstid och 995 kr/månad.
                        </span>
                    </label>
                </div>

                <button
                    onClick={handlePaySystemFee}
                    disabled={loading || !acceptedTerms}
                    className={`w-full font-black py-5 rounded-2xl text-xl transition-all active:scale-[0.98] shadow-xl 
                        ${acceptedTerms && !loading 
                            ? 'bg-primary text-white hover:brightness-110 shadow-primary/30' 
                            : 'bg-gray-800 text-gray-600 cursor-not-allowed shadow-none'}`}
                >
                    {loading ? 'LADDAR...' : 'AKTIVERA & BETALA'}
                </button>

                <button 
                    onClick={onLogout}
                    className="mt-8 text-gray-600 hover:text-gray-400 font-medium text-sm transition-colors uppercase tracking-widest"
                >
                    Logga ut och slutför senare
                </button>
            </motion.div>
        </div>
    );
};