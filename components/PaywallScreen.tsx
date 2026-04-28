import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Organization } from '../types';

// --- NY EXPORT: PAYWALL SCREEN (Dörrvakten) ---
export const PaywallScreen: React.FC<{ onLogout: () => void, userData?: any }> = ({ onLogout, userData }) => {
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubscribe = async () => {
        if (!userData?.uid || !userData?.organizationId) {
            setErrorMsg("Kunde inte hitta användaruppgifter.");
            return;
        }
        
        setLoading(true);
        setErrorMsg("");
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await fetch(`${apiUrl}/create-member-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userData.uid,
                    organizationId: userData.organizationId,
                    email: userData.email
                }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else if (data.error) {
                setErrorMsg(data.error);
            }
        } catch (error) {
            console.error("Betalningsfel:", error);
            setErrorMsg("Kunde inte starta betalning.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center w-full">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 shadow-2xl"
            >

                <h2 className="text-3xl font-black text-white mb-4">Aktivera Medlemskap</h2>
                <p className="text-gray-400 mb-8">
                    Få full tillgång till den nya medlemsappen med passloggning, statistik och personliga mål för endast <strong>39 kr/mån</strong>.
                </p>
                
                {errorMsg && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm">
                        {errorMsg}
                    </div>
                )}

                <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full bg-primary text-white font-black py-4 rounded-2xl text-lg mb-4 hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                >
                    {loading ? 'Laddar...' : 'STARTA PRENUMERATION'}
                </button>

                <button onClick={onLogout} className="text-gray-500 hover:text-white text-sm transition-colors">
                    Logga ut
                </button>
            </motion.div>
        </div>
    );
};

// --- DIN BEFINTLIGA KOMPONENT (Företagsinfo) ---
export const CompanyInfoContent: React.FC<{ organization: Organization; onEdit: () => void }> = ({ organization, onEdit }) => {
    const { companyDetails } = organization;
    const hasDetails = companyDetails && (companyDetails.legalName || companyDetails.orgNumber);

    return (
         <div className="bg-slate-50 dark:bg-gray-800/50 p-6 rounded-xl border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-700 pb-4 mb-6">
                 <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Ekonomi & Licens</h3>
                 <button 
                    onClick={onEdit} 
                    className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                 >
                    Redigera uppgifter
                 </button>
             </div>

             {hasDetails ? (
                 <div className="space-y-8">
                     {/* Basic Info */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Juridiskt Namn</label>
                             <p className="text-lg font-medium text-gray-900 dark:text-white">{companyDetails?.legalName || 'Ej angett'}</p>
                         </div>
                         <div>
                             <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Organisationsnummer</label>
                             <p className="text-lg font-medium text-gray-900 dark:text-white font-mono">{companyDetails?.orgNumber || 'Ej angett'}</p>
                         </div>
                     </div>

                     {/* Billing Address */}
                     {companyDetails.billingAddress && (
                         <div>
                             <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                 <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                 Faktureringsadress
                             </h4>
                             <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-slate-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                                 <p>{companyDetails.billingAddress.street || 'Gatuadress saknas'}</p>
                                 <p>{companyDetails.billingAddress.zip} {companyDetails.billingAddress.city}</p>
                             </div>
                         </div>
                     )}

                     {/* Contact Person */}
                     {companyDetails.billingContact && (
                         <div>
                             <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                 <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                 Kontaktperson & Faktura
                             </h4>
                             <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-slate-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-0.5">Fakturamail</label>
                                     <p className="font-medium text-gray-900 dark:text-white">{companyDetails.billingContact.email || '-'}</p>
                                 </div>
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-0.5">Kontaktperson</label>
                                     <p className="font-medium text-gray-900 dark:text-white">{companyDetails.billingContact.name || '-'}</p>
                                 </div>
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-0.5">E-post (Kontakt)</label>
                                     <p className="font-medium text-gray-900 dark:text-white">{companyDetails.billingContact.emailContact || '-'}</p>
                                 </div>
                                 <div>
                                     <label className="block text-xs text-gray-500 mb-0.5">Telefon</label>
                                     <p className="font-medium text-gray-900 dark:text-white">{companyDetails.billingContact.phone || '-'}</p>
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Economy & Billing */}
                     <div>
                         <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                             Ekonomi & Utbetalningar
                         </h4>
                         <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-slate-200 dark:border-gray-700 space-y-4">
                             <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-4">
                                 <div>
                                     <p className="font-bold text-gray-900 dark:text-white">Medlemspris i appen</p>
                                     <p className="text-sm text-gray-500">Pris som era medlemmar betalar för tillgång</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="font-bold text-lg text-gray-900 dark:text-white">39 kr/mån</p>
                                     <p className="text-sm font-semibold text-green-600 dark:text-green-400">Er intäkt: 20 kr/mån</p>
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
                                 <p><strong>Information om utbetalningar:</strong> Utbetalning av er intäkt (20 kr per aktiv betalande medlem) sker månadsvis. Eventuella kostnader för extra coach-konton eller rabatterade medlemmar dras av från denna summa. Den exakta sammanställningen hanteras via vår betalningspartner (Stripe).</p>
                             </div>
                         </div>
                     </div>
                 </div>
             ) : (
                 <div className="text-center py-8">
                     <p className="text-gray-500 dark:text-gray-400 mb-4">Ingen företagsinformation har lagts till ännu.</p>
                     <button onClick={onEdit} className="text-primary font-semibold hover:underline">Lägg till uppgifter nu</button>
                 </div>
             )}
        </div>
    );
};
