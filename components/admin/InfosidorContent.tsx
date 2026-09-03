
import React, { useState } from 'react';
import { Organization, CustomPage } from '../../types';
import { DocumentTextIcon, LinkIcon } from '../icons';
import { DokumentPopup, oppnaLank, DokumentIPopup } from '../CustomContentScreen';
import { NyMarke, NYHETER } from '../../utils/nyheter';

interface InfosidorContentProps {
    organization: Organization;
    onEditCustomPage: (page: CustomPage | null) => void;
    onDeleteCustomPage: (pageId: string) => Promise<void>;
    onUpdateCustomPages?: (organizationId: string, pages: CustomPage[]) => Promise<void>;
}

export const InfosidorContent: React.FC<InfosidorContentProps> = ({ organization, onEditCustomPage, onDeleteCustomPage, onUpdateCustomPages }) => {
    // LANKKORT: en rubrik och en adress — inget mer. Kortet ligger bland
    // infosidorna och oppnar dokumentet direkt pa coachsidan.
    const [lankRuta, setLankRuta] = useState<{ id: string | null; titel: string; adress: string } | null>(null);
    const [sparar, setSparar] = useState(false);
    const [dokumentPopup, setDokumentPopup] = useState<DokumentIPopup | null>(null);

    const sparaLank = async () => {
        if (!lankRuta || !onUpdateCustomPages) return;
        let adress = lankRuta.adress.trim();
        const titel = lankRuta.titel.trim();
        if (!titel || !adress) return;
        if (!/^https?:\/\//i.test(adress)) adress = 'https://' + adress;
        setSparar(true);
        try {
            const sidor = organization.customPages || [];
            const nytt: CustomPage = { id: lankRuta.id || `link-${Date.now()}`, title: titel, tabs: [], linkUrl: adress };
            const uppdaterade = lankRuta.id ? sidor.map(s => s.id === lankRuta.id ? nytt : s) : [...sidor, nytt];
            await onUpdateCustomPages(organization.id, uppdaterade);
            setLankRuta(null);
        } catch (e) {
            console.error(e);
            alert('Kunde inte spara länken.');
        } finally {
            setSparar(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {dokumentPopup && <DokumentPopup dokument={dokumentPopup} onClose={() => setDokumentPopup(null)} />}
            {lankRuta && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setLankRuta(null)} />
                    <div className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
                        <h4 className="font-black text-gray-900 dark:text-white">{lankRuta.id ? 'Ändra länk' : 'Lägg till länk'}</h4>
                        <p className="text-xs text-gray-500">Till exempel ett dokument eller en PDF i Google Drive. Rubriken står på kortet; dokumentet öppnas direkt när man trycker på det.</p>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Rubrik</label>
                            <input
                                type="text"
                                value={lankRuta.titel}
                                onChange={e => setLankRuta({ ...lankRuta, titel: e.target.value })}
                                placeholder="T.ex. Personalhandbok (PDF)"
                                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Adress</label>
                            <input
                                type="url"
                                value={lankRuta.adress}
                                onChange={e => setLankRuta({ ...lankRuta, adress: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') sparaLank(); }}
                                placeholder="https://docs.google.com/…"
                                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">Google-dokument måste vara delade "alla med länken kan visa".</p>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setLankRuta(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Avbryt</button>
                            <button onClick={sparaLank} disabled={sparar || !lankRuta.titel.trim() || !lankRuta.adress.trim()} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white disabled:opacity-40">{sparar ? 'Sparar…' : 'Spara'}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                    <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Infosidor</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                        Skapa digitala handböcker, välkomstguider eller instruktioner för dina coacher.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {onUpdateCustomPages && (
                        <button
                            onClick={() => setLankRuta({ id: null, titel: '', adress: '' })}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                        >
                            <LinkIcon className="w-5 h-5" /> Lägg till länk
                            <NyMarke nar={NYHETER.infosidorLankar} className="ml-0" />
                        </button>
                    )}
                    <button 
                        onClick={() => onEditCustomPage(null)} 
                        className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                    >
                        <span className="text-xl">+</span> Skapa ny sida
                    </button>
                </div>
            </div>
            
            {(organization.customPages || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 mb-4">
                        <DocumentTextIcon className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga infosidor än</h4>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md text-center mb-8">
                        Infosidor är perfekta för att samla viktig information på ett ställe.
                    </p>
                    <button 
                        onClick={() => onEditCustomPage(null)} 
                        className="text-primary font-semibold hover:underline"
                    >
                        Skapa din första sida nu
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {organization.customPages!.map(page => (
                        <div 
                            key={page.id} 
                            className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 flex flex-col h-full"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${page.linkUrl ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400'}`}>
                                    {page.linkUrl ? <LinkIcon className="w-6 h-6" /> : <DocumentTextIcon className="w-6 h-6" />}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteCustomPage(page.id); }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Ta bort sida"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-6 flex-grow">
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                                    {page.title}
                                </h4>
                                {page.linkUrl ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded text-xs font-medium text-emerald-700 dark:text-emerald-300">Länk</span>
                                        <span>•</span>
                                        <span className="truncate">{page.linkUrl.replace(/^https?:\/\//, '')}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-medium text-gray-600 dark:text-gray-300">
                                            {page.tabs.length} {page.tabs.length === 1 ? 'flik' : 'flikar'}
                                        </span>
                                        <span>•</span>
                                        <span className="truncate">
                                            {page.tabs[0]?.title || 'Utan rubrik'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {page.linkUrl ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => oppnaLank(page.linkUrl!, page.title, setDokumentPopup)}
                                        className="flex-1 bg-gray-50 dark:bg-gray-700/50 hover:bg-primary hover:text-white text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <span>Öppna</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </button>
                                    {onUpdateCustomPages && (
                                        <button
                                            onClick={() => setLankRuta({ id: page.id, titel: page.title, adress: page.linkUrl! })}
                                            className="bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all"
                                            title="Ändra rubrik eller adress"
                                        >
                                            Ändra
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button 
                                    onClick={() => onEditCustomPage(page)} 
                                    className="w-full bg-gray-50 dark:bg-gray-700/50 hover:bg-primary hover:text-white text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <span>Redigera innehåll</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
