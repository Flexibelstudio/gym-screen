
import React, { useState, useEffect, useMemo } from 'react';
import { Organization, InfoCarousel, InfoMessage, Studio } from '../../types';
import { ToggleSwitch, ChevronDownIcon, ChevronUpIcon, BuildingIcon } from '../icons';
import { InputField, SelectField, ImageUploaderForBanner, TextareaField, CheckboxField, AILoadingSpinner } from './AdminShared';
import { generateCarouselImage } from '../../services/geminiService';
import { uploadImage } from '../../services/firebaseService';

interface InfoKarusellContentProps {
    organization: Organization;
    onUpdateInfoCarousel: (organizationId: string, infoCarousel: InfoCarousel) => Promise<void>;
}

const InfoMessageEditor: React.FC<{
    initialMessage: InfoMessage,
    onSave: (message: InfoMessage) => void,
    onCancel: () => void,
    studios: Studio[],
    organizationId: string
}> = ({ initialMessage, onSave, onCancel, studios, organizationId }) => {
    const [formData, setFormData] = useState<InfoMessage>(initialMessage);
    const [customAiPrompt, setCustomAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    
    const handleInputChange = (field: keyof InfoMessage, value: string | number | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleStudioVisibilityChange = (studioId: string, checked: boolean) => {
        let newVisibleInStudios = [...formData.visibleInStudios];
        const isAllChecked = newVisibleInStudios.includes('all');

        if (studioId === 'all') {
            newVisibleInStudios = checked ? ['all', ...studios.map(s => s.id)] : [];
        } else {
            if (checked) {
                newVisibleInStudios.push(studioId);
            } else {
                newVisibleInStudios = newVisibleInStudios.filter(id => id !== studioId);
            }
            const allIndividualChecked = studios.every(s => newVisibleInStudios.includes(s.id));
            if (allIndividualChecked && !isAllChecked) {
                newVisibleInStudios.push('all');
            } else if (!allIndividualChecked && isAllChecked) {
                newVisibleInStudios = newVisibleInStudios.filter(id => id !== 'all');
            }
        }
        handleInputChange('visibleInStudios', [...new Set(newVisibleInStudios)]);
    };

    const handleGenerateImage = async () => {
        const contentContext = formData.headline || formData.body;
        if (!customAiPrompt && !contentContext) {
            alert("Skriv en instruktion till AI:n eller fyll i rubrik/brödtext först.");
            return;
        }

        setIsGenerating(true);
        try {
            let prompt = "";
            if (customAiPrompt) {
                prompt = `En professionell, modern och stilren reklambanner för ett gym eller hälsostudio. ${customAiPrompt}. Stilen ska vara inspirerande och energifylld. Undvik text i bilden.`;
            } else {
                prompt = `En professionell, modern och stilren reklambanner för ett gym eller hälsostudio. Temat är "${formData.headline}". Stilen ska vara inspirerande och energifylld. Undvik text i bilden. ${formData.body}`;
            }

            const imageDataUrl = await generateCarouselImage(prompt);
            const path = `organizations/${organizationId}/carousel_images/${Date.now()}.jpg`;
            const downloadURL = await uploadImage(path, imageDataUrl);
            handleInputChange('imageUrl', downloadURL);
        } catch (error) {
            alert("Kunde inte generera bild: " + (error as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const showImageUploader = formData.layout === 'image-left' || formData.layout === 'image-right';

    return (
        <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg animate-fade-in">
             <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{initialMessage.internalTitle === 'Nytt meddelande' ? 'Skapa nytt meddelande' : 'Redigera meddelande'}</h2>
             </div>
            
            <InputField label="Intern titel (endast för dig)" value={formData.internalTitle} onChange={val => handleInputChange('internalTitle', val)} required placeholder="t.ex. Sommarkampanj 2025"/>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField label="Layout" value={formData.layout} onChange={val => handleInputChange('layout', val)}>
                    <option value="text-only">Endast text</option>
                    <option value="image-left">Bild till vänster</option>
                    <option value="image-right">Bild till höger</option>
                </SelectField>
                 <SelectField label="Animation" value={formData.animation} onChange={val => handleInputChange('animation', val)}>
                    <option value="fade">Tona in</option>
                    <option value="slide-left">Glid in från vänster</option>
                    <option value="slide-right">Glid in från höger</option>
                </SelectField>
            </div>
            
            {showImageUploader && (
                <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Bildhantering</label>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">AI-driven</span>
                    </div>
                    
                    <TextareaField 
                        label="AI-bildinstruktion (frivilligt)" 
                        value={customAiPrompt} 
                        onChange={setCustomAiPrompt} 
                        placeholder="Beskriv bilden, t.ex. 'En kvinna som springer i solnedgång'. Om tomt baseras den på rubriken." 
                        rows={2} 
                    />

                     <div className="relative">
                        <ImageUploaderForBanner 
                            imageUrl={formData.imageUrl || null} 
                            onImageChange={url => handleInputChange('imageUrl', url)} 
                            disabled={isGenerating} 
                            organizationId={organizationId} 
                        />
                        {!formData.imageUrl && (
                            <button 
                                onClick={handleGenerateImage} 
                                disabled={isGenerating} 
                                className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 shadow-md transition-transform hover:scale-105"
                            >
                                {isGenerating ? <AILoadingSpinner /> : '✨'}
                                <span>{isGenerating ? 'Genererar...' : 'Generera bild'}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
                <InputField label="Rubrik" placeholder="Rubrik som visas på skärmen" value={formData.headline} onChange={val => handleInputChange('headline', val)} />
                <TextareaField label="Brödtext" placeholder="Meddelandetexten..." value={formData.body} onChange={val => handleInputChange('body', val)} rows={3} />
                <InputField label="Visningstid (sekunder)" type="number" value={String(formData.durationSeconds)} onChange={val => handleInputChange('durationSeconds', Number(val))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl">
                <InputField label="Startdatum (frivilligt)" type="date" value={formData.startDate || ''} onChange={val => handleInputChange('startDate', val)} />
                <InputField label="Slutdatum (frivilligt)" type="date" value={formData.endDate || ''} onChange={val => handleInputChange('endDate', val)} />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Vilka skärmar ska se detta?</label>
                <div className="flex flex-wrap gap-3">
                    <CheckboxField label="Alla skärmar" checked={formData.visibleInStudios.includes('all')} onChange={checked => handleStudioVisibilityChange('all', checked)} />
                    {studios.map(studio => (
                        <CheckboxField key={studio.id} label={studio.name} checked={formData.visibleInStudios.includes('all') || formData.visibleInStudios.includes(studio.id)} onChange={checked => handleStudioVisibilityChange(studio.id, checked)} />
                    ))}
                </div>
            </div>
            
             <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                <button onClick={onCancel} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 px-6 rounded-xl transition-colors">Avbryt</button>
                <button onClick={() => onSave(formData)} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-8 rounded-xl shadow-md transition-transform active:scale-95">Spara</button>
            </div>
        </div>
    );
};

export const InfoKarusellContent: React.FC<InfoKarusellContentProps> = ({ organization, onUpdateInfoCarousel }) => {
    const [carousel, setCarousel] = useState<InfoCarousel>(() => 
        JSON.parse(JSON.stringify(organization.infoCarousel || { isEnabled: false, messages: [] }))
    );
    const [editingMessage, setEditingMessage] = useState<InfoMessage | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isArchiveOpen, setIsArchiveOpen] = useState(false);

    useEffect(() => {
        setCarousel(JSON.parse(JSON.stringify(organization.infoCarousel || { isEnabled: false, messages: [] })));
    }, [organization.infoCarousel]);

    const handleGlobalSave = async (updatedCarousel: InfoCarousel) => {
        setIsSaving(true);
        try {
            await onUpdateInfoCarousel(organization.id, updatedCarousel);
        } catch (error) {
            alert("Kunde inte spara ändringar.");
            setCarousel(JSON.parse(JSON.stringify(organization.infoCarousel || { isEnabled: false, messages: [] })));
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleCarousel = (isEnabled: boolean) => {
        const updatedCarousel = { ...carousel, isEnabled };
        setCarousel(updatedCarousel);
        handleGlobalSave(updatedCarousel);
    };

    const handleCreateNew = () => {
        setEditingMessage({
            id: `msg-${Date.now()}`,
            internalTitle: 'Nytt meddelande',
            headline: '',
            body: '',
            layout: 'image-left',
            imageUrl: '',
            animation: 'fade',
            durationSeconds: 10,
            visibleInStudios: ['all'],
            startDate: '',
            endDate: ''
        });
    };

    const handleSaveMessage = (messageToSave: InfoMessage) => {
        const isNew = !carousel.messages.some(m => m.id === messageToSave.id);
        const newMessages = isNew
            ? [...carousel.messages, messageToSave]
            : carousel.messages.map(m => m.id === messageToSave.id ? messageToSave : m);
        
        const updatedCarousel = { ...carousel, messages: newMessages };
        setCarousel(updatedCarousel);
        handleGlobalSave(updatedCarousel);
        setEditingMessage(null);
    };

    const handleDeleteMessage = (messageId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta meddelande?")) {
            const newMessages = carousel.messages.filter(m => m.id !== messageId);
            const updatedCarousel = { ...carousel, messages: newMessages };
            setCarousel(updatedCarousel);
            handleGlobalSave(updatedCarousel);
        }
    };

    // --- Grouping Logic ---
    const { activeMessages, upcomingMessages, expiredMessages } = useMemo(() => {
        const now = new Date();
        const active: InfoMessage[] = [];
        const upcoming: InfoMessage[] = [];
        const expired: InfoMessage[] = [];

        carousel.messages.forEach(msg => {
            const start = msg.startDate ? new Date(msg.startDate) : null;
            const end = msg.endDate ? new Date(msg.endDate) : null;

            if (end && end < now) {
                expired.push(msg);
            } else if (start && start > now) {
                upcoming.push(msg);
            } else {
                active.push(msg);
            }
        });

        // Sort Active: Alphabetical by internal title
        active.sort((a, b) => a.internalTitle.localeCompare(b.internalTitle));

        // Sort Upcoming: Soonest start date first
        upcoming.sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return dateA - dateB;
        });

        // Sort Expired: Most recently expired first
        expired.sort((a, b) => {
            const dateA = a.endDate ? new Date(a.endDate).getTime() : 0;
            const dateB = b.endDate ? new Date(b.endDate).getTime() : 0;
            return dateB - dateA;
        });

        return { activeMessages: active, upcomingMessages: upcoming, expiredMessages: expired };
    }, [carousel.messages]);


    // --- Helper to render a message card ---
    const renderMessageCard = (msg: InfoMessage, type: 'active' | 'upcoming' | 'expired') => {
        let statusBadge = null;
        let dateInfo = null;

        if (type === 'active') {
            statusBadge = <span className="text-[10px] font-bold text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded uppercase tracking-wider">Visas nu</span>;
            if (msg.endDate) {
                dateInfo = <span className="text-xs text-gray-500">Slutar: {new Date(msg.endDate).toLocaleDateString('sv-SE')}</span>;
            }
        } else if (type === 'upcoming') {
            statusBadge = <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-1 rounded uppercase tracking-wider">Kommande</span>;
            if (msg.startDate) {
                dateInfo = <span className="text-xs text-gray-500 font-medium">Startar: {new Date(msg.startDate).toLocaleDateString('sv-SE')}</span>;
            }
        } else {
            statusBadge = <span className="text-[10px] font-bold text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-400 px-2 py-1 rounded uppercase tracking-wider">Utgången</span>;
            if (msg.endDate) {
                dateInfo = <span className="text-xs text-gray-400">Utgick: {new Date(msg.endDate).toLocaleDateString('sv-SE')}</span>;
            }
        }

        // Logic to determine visible studios text
        const getVisibilityLabel = (ids: string[]) => {
            if (ids.includes('all')) return 'Alla skärmar';
            if (ids.length === 0) return 'Ingen skärm vald';
            const names = ids.map(id => organization.studios.find(s => s.id === id)?.name).filter(Boolean);
            if (names.length === 0) return 'Okända skärmar';
            if (names.length <= 2) return names.join(', ');
            return `${names[0]}, ${names[1]} +${names.length - 2}`;
        };

        const visibilityLabel = getVisibilityLabel(msg.visibleInStudios);

        return (
            <div key={msg.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 border ${type === 'expired' ? 'border-gray-100 dark:border-gray-800 opacity-60 hover:opacity-100' : 'border-gray-200 dark:border-gray-700'} hover:border-primary/30 hover:shadow-sm transition-all group`}>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0 relative">
                        {msg.imageUrl ? (
                            <img src={msg.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">TEXT</div>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {statusBadge}
                            <p className="font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{msg.internalTitle}</p>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-[300px] mb-1">{msg.headline || msg.body || 'Inget innehåll'}</p>
                        <div className="flex items-center gap-3">
                            {dateInfo}
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500" title="Visas på">
                                <BuildingIcon className="w-3 h-3" />
                                <span>{visibilityLabel}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button onClick={() => setEditingMessage(msg)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium text-xs py-2 px-4 rounded-lg transition-colors">Redigera</button>
                    <button onClick={() => handleDeleteMessage(msg.id)} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium text-xs py-2 px-4 rounded-lg transition-colors">Ta bort</button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {!editingMessage && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 animate-fade-in">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Info-karusell</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Hantera nyhetsbannern som rullar längst ner på hemskärmen.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className={`text-sm font-bold pl-2 ${carousel.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                                {carousel.isEnabled ? 'PÅ' : 'AV'}
                            </span>
                            <ToggleSwitch
                                label=""
                                checked={carousel.isEnabled}
                                onChange={handleToggleCarousel}
                            />
                        </div>
                    </div>

                    <button onClick={handleCreateNew} className="w-full py-4 mb-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-primary hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all font-bold flex items-center justify-center gap-2">
                        <span className="text-xl">+</span> Skapa nytt meddelande
                    </button>

                    <div className="space-y-8">
                        
                        {/* 1. Active Messages */}
                        <section>
                            <div className="flex items-center gap-2 mb-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Visas på skärmarna</h4>
                                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold px-2 py-0.5 rounded-full">{activeMessages.length}</span>
                            </div>
                            
                            {!carousel.isEnabled && activeMessages.length > 0 && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg mb-4 text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>Karusellen är avstängd globalt. Dessa inlägg visas inte just nu.</span>
                                </div>
                            )}

                            {activeMessages.length > 0 ? (
                                <div className="space-y-3">
                                    {activeMessages.map(msg => renderMessageCard(msg, 'active'))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 italic">Inga aktiva meddelanden just nu.</p>
                            )}
                        </section>

                        {/* 2. Upcoming Messages */}
                        {upcomingMessages.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <h4 className="text-sm font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Kommande</h4>
                                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold px-2 py-0.5 rounded-full">{upcomingMessages.length}</span>
                                </div>
                                <div className="space-y-3">
                                    {upcomingMessages.map(msg => renderMessageCard(msg, 'upcoming'))}
                                </div>
                            </section>
                        )}

                        {/* 3. Expired / Archive */}
                        {expiredMessages.length > 0 && (
                            <section className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button 
                                    onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                                    className="flex items-center gap-2 w-full text-left group"
                                >
                                    <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                        {isArchiveOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                        <h4 className="text-sm font-bold uppercase tracking-wider">Arkiv / Utgångna</h4>
                                    </div>
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">{expiredMessages.length}</span>
                                </button>
                                
                                {isArchiveOpen && (
                                    <div className="space-y-3 mt-4 animate-fade-in">
                                        {expiredMessages.map(msg => renderMessageCard(msg, 'expired'))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            )}
            
            {editingMessage && (
                <InfoMessageEditor 
                    initialMessage={editingMessage} 
                    onSave={handleSaveMessage}
                    onCancel={() => setEditingMessage(null)}
                    studios={organization.studios}
                    organizationId={organization.id}
                />
            )}
        </div>
    );
};
