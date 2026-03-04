import React from 'react';
import { useAuth } from '../context/AuthContext';

interface PaywallScreenProps {
    onLogout: () => void;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ onLogout }) => {
    const { userData } = useAuth();
    
    const handleSubscribe = async () => {
        try {
            // Använder din Firebase URL från Netlify's miljövariabler
            const response = await fetch(`${import.meta.env.VITE_API_URL}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userData?.uid,
                    organizationId: userData?.organizationId
                })
            });
            
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('Kunde inte starta betalningen. Försök igen senare.');
            }
        } catch (error) {
            console.error("Error starting checkout:", error);
            alert('Ett fel uppstod vid anslutning till servern. Försök igen senare.');
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in-up border border-gray-200 dark:border-gray-800">
                
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Lås upp din träning
                </h2>
                
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Välkommen {userData?.firstName || 'tillbaka'}! För att få tillgång till alla pass, logga din träning och använda timern behöver du ett aktivt medlemskap.
                </p>

                <div className="space-y-4">
                    <button 
                        onClick={handleSubscribe}
                        className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                    >
                        <span>Aktivera Medlemskap</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                    
                    <button 
                        onClick={onLogout}
                        className="w-full bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold py-3 px-6 rounded-xl transition-colors"
                    >
                        Logga ut
                    </button>
                </div>
            </div>
        </div>
    );
};