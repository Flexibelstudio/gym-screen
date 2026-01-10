import React, { useState, useEffect } from 'react';
import { CompanyDetails } from '../types';

interface CompanyDetailsOnboardingModalProps {
    isOpen: boolean;
    initialDetails?: CompanyDetails;
    onSave: (details: CompanyDetails) => Promise<void>;
    onSkip: () => void;
}

const InputField: React.FC<{label: string, value?: string, onChange: (val: string) => void, required?: boolean, type?: string}> = ({label, value, onChange, required, type="text"}) => (
     <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}{required && <span className="text-red-400">*</span>}</label>
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
        />
    </div>
);

export const CompanyDetailsOnboardingModal: React.FC<CompanyDetailsOnboardingModalProps> = ({ isOpen, initialDetails, onSave, onSkip }) => {
    const [details, setDetails] = useState<CompanyDetails>(initialDetails || {});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialDetails) {
            setDetails(initialDetails);
        }
    }, [initialDetails]);

    if (!isOpen) return null;

    const handleInputChange = (section: 'billingAddress' | 'billingContact', field: string, value: string) => {
        setDetails(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };
    
    const handleSimpleChange = (field: keyof Omit<CompanyDetails, 'billingAddress' | 'billingContact'>, value: string) => {
        setDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(details);
        } catch (e) {
            console.error(e);
            // Don't close modal on error, let user try again.
        } finally {
            setIsSaving(false);
        }
    };

    const isSaveDisabled = !details.legalName?.trim() || !details.orgNumber?.trim() || isSaving;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-fade-in">
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-2xl text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col"
            >
                <div className="flex-shrink-0">
                    <h2 className="text-2xl font-bold mb-2">Välkommen! Vänligen komplettera era företagsuppgifter.</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">För att vi ska kunna säkerställa smidig fakturering och support behöver vi era fullständiga företagsuppgifter. Detta behöver bara fyllas i en gång.</p>
                </div>
                
                <form onSubmit={e => {e.preventDefault(); handleSave()}} className="flex-grow overflow-y-auto pr-2 space-y-6">
                    {/* Företagsinformation */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-primary">Företagsinformation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Juridiskt Företagsnamn" value={details.legalName} onChange={val => handleSimpleChange('legalName', val)} required />
                            <InputField label="Organisationsnummer" value={details.orgNumber} onChange={val => handleSimpleChange('orgNumber', val)} required />
                        </div>
                    </div>

                    {/* Faktureringsadress */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-primary">Faktureringsadress</h4>
                        <InputField label="Gatuadress" value={details.billingAddress?.street} onChange={val => handleInputChange('billingAddress', 'street', val)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Postnummer" value={details.billingAddress?.zip} onChange={val => handleInputChange('billingAddress', 'zip', val)} />
                            <InputField label="Ort" value={details.billingAddress?.city} onChange={val => handleInputChange('billingAddress', 'city', val)} />
                        </div>
                    </div>
                    
                    {/* Kontaktuppgifter */}
                    <div className="space-y-4">
                         <h4 className="text-lg font-semibold text-primary">Kontaktuppgifter</h4>
                        <InputField label="Faktureringsmail (för fakturor)" type="email" value={details.billingContact?.email} onChange={val => handleInputChange('billingContact', 'email', val)} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Namn på kontaktperson" value={details.billingContact?.name} onChange={val => handleInputChange('billingContact', 'name', val)} />
                            <InputField label="E-post till kontaktperson" type="email" value={details.billingContact?.emailContact} onChange={val => handleInputChange('billingContact', 'emailContact', val)} />
                            <InputField label="Telefon till kontaktperson" value={details.billingContact?.phone} onChange={val => handleInputChange('billingContact', 'phone', val)} />
                        </div>
                    </div>
                </form>

                <div className="mt-8 flex gap-4 flex-shrink-0">
                    <button onClick={onSkip} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Fyll i senare</button>
                    <button onClick={handleSave} disabled={isSaveDisabled} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isSaving ? 'Sparar...' : 'Spara Uppgifter'}
                    </button>
                </div>
            </div>
        </div>
    );
};