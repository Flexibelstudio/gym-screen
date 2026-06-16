
import React, { useState } from 'react';
import { Organization } from '../../types';
import { InputField, ImageUploaderForBanner } from './AdminShared';

interface VarumarkeContentProps {
    organization: Organization;
    onUpdatePasswords: (organizationId: string, passwords: Organization['passwords']) => Promise<void>;
    onUpdateLogos: (organizationId: string, logos: { light: string; dark: string }) => Promise<void>;
    onUpdateFavicon: (organizationId: string, faviconUrl: string) => Promise<void>;
    onUpdateAppIcon?: (organizationId: string, appIconUrl: string) => Promise<void>;
    onUpdatePrimaryColor: (organizationId: string, color: string) => Promise<void>;
    onShowToast: (message: string) => void;
}

export const VarumarkeContent: React.FC<VarumarkeContentProps> = ({ 
    organization, onUpdatePasswords, onUpdateLogos, onUpdateFavicon, onUpdateAppIcon, onUpdatePrimaryColor, onShowToast
}) => {
    const [passwords, setPasswords] = useState(organization.passwords);
    const [logoLight, setLogoLight] = useState(organization.logoUrlLight || '');
    const [logoDark, setLogoDark] = useState(organization.logoUrlDark || '');
    const [favicon, setFavicon] = useState(organization.faviconUrl || '');
    const [appIcon, setAppIcon] = useState(organization.appIconUrl || '');
    const [primaryColor, setPrimaryColor] = useState(organization.primaryColor || '#14b8a6');
    const [isSaving, setIsSaving] = useState(false);

    const isDirty = 
        passwords.coach !== organization.passwords.coach ||
        logoLight !== (organization.logoUrlLight || '') ||
        logoDark !== (organization.logoUrlDark || '') ||
        favicon !== (organization.faviconUrl || '') ||
        appIcon !== (organization.appIconUrl || '') ||
        primaryColor !== (organization.primaryColor || '#14b8a6');

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const promises: Promise<any>[] = [
                onUpdatePasswords(organization.id, passwords),
                onUpdateLogos(organization.id, { light: logoLight, dark: logoDark }),
                onUpdateFavicon(organization.id, favicon),
                onUpdatePrimaryColor(organization.id, primaryColor)
            ];
            if (onUpdateAppIcon) {
                promises.push(onUpdateAppIcon(organization.id, appIcon));
            }
            await Promise.all(promises);
            onShowToast("Ändringar sparade!");
        } catch (error) {
            onShowToast("Kunde inte spara ändringar.");
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
                            <p className="text-xs text-gray-500 mt-2">Ladda upp en mörk logotyp som syns bra mot vita bakgrunder. <strong className="text-gray-700 dark:text-gray-300">Bilden måste ha en genomskinlig bakgrund (oftast en .PNG eller .SVG).</strong></p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logotyp (Mörkt tema)</label>
                            <ImageUploaderForBanner 
                                imageUrl={logoDark} 
                                onImageChange={setLogoDark} 
                                organizationId={organization.id} 
                            />
                            <p className="text-xs text-gray-500 mt-2">Ladda upp en ljus logotyp som syns bra mot mörka bakgrunder. <strong className="text-gray-700 dark:text-gray-300">Bilden måste ha en genomskinlig bakgrund (oftast en .PNG eller .SVG).</strong></p>
                        </div>
                    </div>
                </section>
                         {/* Favicon / App Icon */}
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Ikoner & Hemskärm</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 1. Favicon / Spel-ikon */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">
                                    1. Flik- & Spel-ikon (Favicon)
                                </label>
                                <p className="text-xs text-gray-500 mb-4">
                                    Visas i webbläsarens flik och i träningslekar (t.ex. roulette, slotmachine). 
                                </p>
                                <ImageUploaderForBanner 
                                    imageUrl={favicon} 
                                    onImageChange={setFavicon} 
                                    organizationId={organization.id} 
                                />
                                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                                    <strong className="text-teal-600 dark:text-teal-400">Genomskinlig bakgrund (.PNG eller .SVG) rekommenderas starkt</strong> för att spel och tabbar ska se sömlösa ut mot olika mörka och ljusa bakgrunder.
                                </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 border border-gray-200 dark:border-gray-700 flex items-center justify-center p-2">
                                    {favicon ? <img src={favicon} alt="Preview" className="w-full h-full object-contain" /> : <div className="w-full h-full bg-primary/20"></div>}
                                </div>
                                <div>
                                    <p className="font-bold text-xs text-gray-900 dark:text-white">Förhandsgranskning i spel/tabbar</p>
                                    <p className="text-[11px] text-gray-500">Här syns ikonen med genomskinlighet.</p>
                                </div>
                            </div>
                        </div>

                        {/* 2. App-ikon / Hemskärm */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-1">
                                    2. Hemskärms-ikon (iOS & Android App-ikon)
                                </label>
                                <p className="text-xs text-gray-500 mb-4">
                                    Visas på telefonens hemskärm när medlemmar sparar ner appen på sin mobil.
                                </p>
                                <ImageUploaderForBanner 
                                    imageUrl={appIcon} 
                                    onImageChange={setAppIcon} 
                                    organizationId={organization.id} 
                                />
                                <p className="text-xs text-gray-500 mt-3 leading-relaxed">
                                    <strong className="text-amber-600 dark:text-amber-400">VIKTIGT: Skall ha en helt SOLID/fylld bakgrundsbild</strong>. Undvik genomskinlig bakgrund här, annars blir ikonen ofta helt vit eller svart på iPhone-skärmar.
                                </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md shrink-0 border border-gray-300 dark:border-gray-600">
                                    {appIcon ? (
                                        <img src={appIcon} alt="Preview" className="w-full h-full object-cover" />
                                    ) : favicon ? (
                                        <img src={favicon} alt="Preview fallback" className="w-full h-full object-cover bg-black" />
                                    ) : (
                                        <div className="w-full h-full bg-primary/20"></div>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-xs text-gray-900 dark:text-white">Förhandsgranskning på hemskärmen</p>
                                    <p className="text-[11px] text-gray-500">Visas med avrundade hörn utan genomskinlig bakgrund.</p>
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
