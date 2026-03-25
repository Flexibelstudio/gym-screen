
import React from 'react';
import { Organization } from '../../types';

export const CompanyInfoContent: React.FC<{ organization: Organization; onEdit: () => void }> = ({ organization, onEdit }) => {
    const { companyDetails } = organization;
    const hasDetails = companyDetails && (companyDetails.legalName || companyDetails.orgNumber);

    return (
         <div className="bg-slate-50 dark:bg-gray-800/50 p-6 rounded-xl border border-slate-200 dark:border-gray-700">
             <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-700 pb-4 mb-6">
                 <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Företagsinformation</h3>
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
                                 <h5 className="font-bold text-gray-900 dark:text-white mb-2">Stripe-konto för utbetalningar</h5>
                                 {organization.stripeConnectAccountId ? (
                                     <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                             </div>
                                             <div>
                                                 <p className="font-bold text-green-800 dark:text-green-300">Konto kopplat</p>
                                                 <p className="text-xs text-green-600 dark:text-green-400">ID: {organization.stripeConnectAccountId}</p>
                                             </div>
                                         </div>
                                         <button 
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('https://api-mioe74iqdi7yxzjsz433lx-46889914413.europe-west2.run.app/create-connect-account', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ organizationId: organization.id })
                                                    });
                                                    const data = await res.json();
                                                    if (data.url) window.location.href = data.url;
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }}
                                            className="text-sm bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/40 transition-colors"
                                         >
                                             Hantera konto
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
                                         <button 
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch('https://api-mioe74iqdi7yxzjsz433lx-46889914413.europe-west2.run.app/create-connect-account', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ organizationId: organization.id })
                                                    });
                                                    const data = await res.json();
                                                    if (data.url) window.location.href = data.url;
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }}
                                            className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                         >
                                             Koppla Stripe
                                         </button>
                                     </div>
                                 )}
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
