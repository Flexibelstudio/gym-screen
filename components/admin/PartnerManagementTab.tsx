import React, { useState, useEffect, useRef } from 'react';
import { Partner } from '../../types';
import { getPartners, addPartner, removePartner } from '../../services/firebaseService';
import { TrashIcon, PlusIcon } from '../icons';

export const PartnerManagementTab: React.FC = () => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [partnerName, setPartnerName] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadPartners();
    }, []);

    const loadPartners = async () => {
        setIsLoading(true);
        const data = await getPartners();
        setPartners(data);
        setIsLoading(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!partnerName.trim()) {
            alert("Vänligen fyll i partner-namn först så vi kan spara logotypen korrekt.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsUploading(true);
        const newPartner = await addPartner(file, partnerName.trim(), websiteUrl.trim());
        if (newPartner) {
            setPartners([newPartner, ...partners]);
            setPartnerName('');
            setWebsiteUrl('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            alert("Ett fel uppstod vid uppladdning av partner-logotypen.");
        }
        setIsUploading(false);
    };

    const handleDelete = async (id: string, logoUrl: string) => {
        if (window.confirm("Är du säker på att du vill ta bort denna partner?")) {
            await removePartner(id, logoUrl);
            setPartners(partners.filter(p => p.id !== id));
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Partners & Sponsorer (Landningssida)</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Hantera samarbetspartners och sponsorer som visas på landningssidan. De visas endast om det finns minst en partner inlagd. Rekommenderas liggande eller kvadratiska bilder med genomskinlig/enhetlig bakgrund.
            </p>

            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-8 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lägg till ny partner</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Partner-namn *</label>
                        <input
                            type="text"
                            value={partnerName}
                            onChange={(e) => setPartnerName(e.target.value)}
                            placeholder="T.ex. Eleiko"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webbplats URL (frivilligt)</label>
                        <input
                            type="url"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            placeholder="https://www.eleiko.com"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            id="partner-upload"
                            disabled={!partnerName.trim()}
                        />
                        <label
                            htmlFor="partner-upload"
                            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white transition-colors cursor-pointer ${
                                !partnerName.trim()
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : isUploading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-primary hover:bg-primary/90'
                            }`}
                        >
                            {isUploading ? 'Laddar upp...' : <><PlusIcon /> Välj logotyp & spara</>}
                        </label>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-gray-500">Laddar partners...</div>
            ) : partners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Inga partners inlagda ännu. Sektionen visas inte på landningssidan för tillfället.</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {partners.map(partner => (
                        <div key={partner.id} className="relative group rounded-lg p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-between min-h-[160px]">
                            <div className="w-full h-20 flex items-center justify-center bg-white dark:bg-gray-850 rounded-md p-2 mb-2 border border-gray-150 dark:border-gray-800">
                                <img src={partner.logoUrl} alt={partner.name} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="text-center w-full">
                                <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                    {partner.name}
                                </div>
                                {partner.websiteUrl && (
                                    <a
                                        href={partner.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline truncate block"
                                    >
                                        Länk ↗
                                    </a>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(partner.id, partner.logoUrl)}
                                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                title="Ta bort partner"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
