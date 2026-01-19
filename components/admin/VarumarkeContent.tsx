
import React, { useState } from 'react';
import { Organization } from '../../types';
import { InputField, ImageUploaderForBanner } from './AdminShared';

interface VarumarkeContentProps {
    organization: Organization;
    onUpdatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
    onUpdateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
    onUpdateFavicon: (organizationId: string, faviconUrl: string) => Promise<void>;
    onUpdatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
}

export const VarumarkeContent: React.FC<VarumarkeContentProps> = ({ 
    organization, onUpdatePasswords, onUpdateLogos, onUpdateFavicon, onUpdatePrimaryColor 
}) => {
    const [passwords, setPasswords] = useState(organization.passwords);
    const [logoLight, setLogoLight] = useState(organization.logoUrlLight || '');
    const [logoDark, setLogoDark] = useState(organization.logoUrlDark || '');
    const [favicon, setFavicon] = useState(organization.faviconUrl || '');
    const [primaryColor, setPrimaryColor] = useState(organization.primaryColor || '#14b8a6');
    const [isSaving, setIsSaving] = useState(false);

    const isDirty = 
        passwords.coach !== organization.passwords.coach ||
        logoLight !== (organization.logoUrlLight || '') ||
        logoDark !== (organization.logoUrlDark || '') ||
        favicon !== (organization.faviconUrl || '') ||
        primaryColor !== (organization.primaryColor || '#14b8a6');

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                onUpdatePasswords(organization.id, passwords),
                onUpdateLogos(organization.id, { light: logoLight, dark: logoDark }),
                onUpdateFavicon(organization.id, favicon),
                onUpdatePrimaryColor(organization.id, primaryColor)
            ]);
            alert("Ändringar sparade!");
        } catch (error) {
            alert("Kunde inte spara ändringar.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Varumärke & Säkerhet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Hantera lösenord, logotyper och färger.</p>
                </div>
                 <button 
                    onClick={handleSave} 
                    disabled={isSaving || !isDirty} 
                    className="bg-primary hover:brightness-95 text-white font-semibold py-2.5 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-transform active:scale-95"
                >
                    {isSaving ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-8">
                {/* Passwords */}
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Lösenord</h4>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="max-w-md">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Coach-lösenord</label>
                            <input 
                                type="text" 
                                value={passwords.coach} 
                                onChange={e => setPasswords(p => ({...p, coach: e.target.value}))} 
                                className="w-full bg-white dark:bg-black p-3 rounded-xl border border-gray-300 dark:border-gray-600 font-mono text-lg tracking-widest focus:ring-2 focus:ring-primary focus:outline-none transition" 
                            />
                            <p className="text-xs text-gray-500 mt-2">Detta lösenord används för att komma åt coach-vyn på surfplattorna.</p>
                        </div>
                    </div>
                </section>

                 {/* Logos */}
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Logotyper</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logotyp (Ljust tema)</label>
                            <ImageUploaderForBanner 
                                imageUrl={logoLight} 
                                onImageChange={setLogoLight} 
                                organizationId={organization.id} 
                            />
                            <p className="text-xs text-gray-500 mt-2">Ladda upp en mörk logotyp (helst PNG med transparent bakgrund) som syns bra mot vita bakgrunder.</p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logotyp (Mörkt tema)</label>
                            <ImageUploaderForBanner 
                                imageUrl={logoDark} 
                                onImageChange={setLogoDark} 
                                organizationId={organization.id} 
                            />
                            <p className="text-xs text-gray-500 mt-2">Ladda upp en ljus logotyp (helst PNG med transparent bakgrund) som syns bra mot mörka bakgrunder.</p>
                        </div>
                    </div>
                </section>

                {/* Favicon / App Icon */}
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">App-ikon & Favicon</h4>
                    <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ikon (512x512px rekommenderas)</label>
                                <ImageUploaderForBanner 
                                    imageUrl={favicon} 
                                    onImageChange={setFavicon} 
                                    organizationId={organization.id} 
                                />
                                <p className="text-xs text-gray-500 mt-2">Denna ikon visas när medlemmar sparar appen på sin hemskärm och som ikon i webbläsarfliken. Använd en kvadratisk bild utan transparens för bästa resultat.</p>
                            </div>
                            <div className="pt-8">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                                        {favicon ? <img src={favicon} alt="Preview" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-primary/20"></div>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">Förhandsgranskning</p>
                                        <p className="text-xs text-gray-500">Så här kommer er ikon se ut i mobilen.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Primary Color */}
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Färgschema</h4>
                    <div className="flex items-center gap-6">
                        <div className="relative group cursor-pointer">
                            <input 
                                type="color" 
                                value={primaryColor} 
                                onChange={e => setPrimaryColor(e.target.value)} 
                                className="w-24 h-24 p-0 border-0 rounded-2xl cursor-pointer overflow-hidden shadow-md" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="bg-black/20 text-white text-xs font-mono px-1 rounded">{primaryColor}</span>
                            </div>
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Primärfärg</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Används på knappar, länkar och accenter.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
