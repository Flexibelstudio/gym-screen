
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
