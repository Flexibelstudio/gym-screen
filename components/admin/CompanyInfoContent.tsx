import React, { useState } from 'react';
import { Organization } from '../../types';

export const CompanyInfoContent: React.FC<{ organization: Organization; onEdit: () => void }> = ({ organization, onEdit }) => {
    const [isConnectingStripe, setIsConnectingStripe] = useState(false);

    return (
         <div className="bg-slate-50 dark:bg-gray-800/50 p-6 rounded-xl border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-700 pb-4 mb-6">
                 <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Ekonomi & Licens</h3>
             </div>

             <div className="space-y-8">
                 {/* Economy & Billing */}
                 <div>
                     <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-slate-200 dark:border-gray-700 space-y-4">
                             <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                                 <div>
                                     <p className="font-bold text-gray-900 dark:text-white">Medlemspris i appen</p>
                                     <p className="text-sm text-gray-500">Pris som era medlemmar betalar för tillgång</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="font-bold text-lg text-gray-900 dark:text-white">39 kr/mån</p>
                                     <p className="text-sm font-semibold text-green-600 dark:text-green-400">Er intäkt: 20 kr/mån (minus kortavgift)</p>
                                 </div>
                             </div>
                             
                             <div className="flex justify-between items-center pt-2">
                                 <div>
                                     <p className="font-bold text-gray-900 dark:text-white">Coach-konton</p>
                                     <p className="text-sm text-gray-500">
                                        Ni har {organization.freeCoachAccounts || 0} gratis coach-konton.
                                     </p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-sm text-gray-900 dark:text-white">Kostnad utöver gratis:</p>
                                     <p className="font-bold text-red-600 dark:text-red-400">19 kr/mån per konto</p>
                                 </div>
                             </div>
                             
                             <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                                 <p><strong>Information om utbetalningar:</strong> Utbetalning av er intäkt (20 kr per aktiv betalande medlem minus Stripes kortavgifter) hanteras automatiskt via Stripe. Ni behöver koppla ett Stripe-konto nedan för att kunna ta emot betalningar.</p>
                             </div>

                             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                                 <h5 className="font-bold text-gray-900 dark:text-white mb-2">SmartStudio Licens</h5>
                                 <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                     <div className="flex items-center gap-3">
                                         <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400">
                                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                         </div>
                                         <div>
                                             <p className="font-bold text-purple-800 dark:text-purple-300">Aktiv Prenumeration</p>
                                             <p className="text-xs text-purple-600 dark:text-purple-400">Systemavgift & licenser</p>
                                         </div>
                                     </div>
                                     <button 
                                        onClick={async () => {
                                            if (!organization.stripeCustomerId) return;
                                            try {
                                                const apiUrl = import.meta.env.VITE_API_URL;
                                                const res = await fetch(`${apiUrl}/create-portal-session`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ customerId: organization.stripeCustomerId, isOrganization: true })
                                                });
                                                const data = await res.json();
                                                if (data.url) window.location.href = data.url;
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                        disabled={!organization.stripeCustomerId}
                                        className="text-sm bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400 px-4 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
                                     >
                                         Hantera prenumeration & kvitton
                                     </button>
                                 </div>
                             </div>

                             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                                 <h5 className="font-bold text-gray-900 dark:text-white mb-2">Stripe-konto för utbetalningar</h5>
                                 {organization.stripeConnectAccountId ? (
                                     <div className={`flex items-center justify-between p-4 rounded-lg border ${organization.stripeConnectSetupComplete ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center ${organization.stripeConnectSetupComplete ? 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-600 dark:text-yellow-400'}`}>
                                                 {organization.stripeConnectSetupComplete ? (
                                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                 ) : (
                                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                                 )}
                                             </div>
                                             <div>
                                                 <p className={`font-bold ${organization.stripeConnectSetupComplete ? 'text-green-800 dark:text-green-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                                     {organization.stripeConnectSetupComplete ? 'Konto kopplat och redo' : 'Konto skapat men ej färdigställt'}
                                                 </p>
                                                 <p className={`text-xs ${organization.stripeConnectSetupComplete ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                                     ID: {organization.stripeConnectAccountId}
                                                 </p>
                                             </div>
                                         </div>
                                         <button 
                                            onClick={async () => {
                                                setIsConnectingStripe(true);
                                                try {
                                                    const apiUrl = import.meta.env.VITE_API_URL;
                                                    const res = await fetch(`${apiUrl}/create-connect-account`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ organizationId: organization.id, returnUrl: window.location.origin })
                                                    });
                                                    const data = await res.json();
                                                    if (data.url) window.location.href = data.url;
                                                } catch (e) {
                                                    console.error(e);
                                                    setIsConnectingStripe(false);
                                                }
                                            }}
                                            disabled={isConnectingStripe}
                                            className="text-sm bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
                                         >
                                             {isConnectingStripe ? 'Laddar...' : 'Hantera konto'}
                                         </button>
                                     </div>
                                 ) : (
                                     <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 bg-orange-100 dark:bg-orange-800 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
                                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                             </div>
                                             <div>
                                                 <p className="font-bold text-orange-800 dark:text-orange-300">Konto ej kopplat</p>
                                                 <p className="text-xs text-orange-600 dark:text-orange-400">Krävs för att ta emot betalningar</p>
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <button 
                                                onClick={async () => {
                                                    setIsConnectingStripe(true);
                                                    try {
                                                        const apiUrl = import.meta.env.VITE_API_URL;
                                                        const res = await fetch(`${apiUrl}/create-connect-account`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ organizationId: organization.id, returnUrl: window.location.origin })
                                                        });
                                                        const data = await res.json();
                                                        if (data.url) window.location.href = data.url;
                                                    } catch (e) {
                                                        console.error(e);
                                                        setIsConnectingStripe(false);
                                                    }
                                                }}
                                                disabled={isConnectingStripe}
                                                className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                             >
                                                 {isConnectingStripe ? (
                                                     <>
                                                         <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                         </svg>
                                                         Laddar...
                                                     </>
                                                 ) : 'Koppla Stripe'}
                                             </button>
                                         </div>
                                     </div>
                                 )}
                             </div>
                         </div>
                     </div>
                 </div>
         </div>
    );
};
