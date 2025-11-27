
import React, { useState, useEffect } from 'react';
import { Organization, InfoCarousel, InfoMessage, Studio } from '../../types';
import { ToggleSwitch } from '../icons';
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
        <div className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
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

    return (
        <div className="space-y-6">
            {!editingMessage && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Info-karusell</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">En rullande nyhetsbanner längst ner på hemskärmen.</p>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 pl-2">Status:</span>
                            <ToggleSwitch
                                label=""
                                checked={carousel.isEnabled}
                                onChange={handleToggleCarousel}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {carousel.messages.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-400">Inga meddelanden i karusellen.</p>
                            </div>
                        ) : carousel.messages.map(msg => (
                            <div key={msg.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 border border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:shadow-sm transition-all group">
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                        {msg.imageUrl ? (
                                            <img src={msg.imageUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Text</div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{msg.internalTitle}</p>
                                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{msg.headline || 'Ingen rubrik'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={() => setEditingMessage(msg)} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium text-sm py-2 px-4 rounded-lg transition-colors">Redigera</button>
                                    <button onClick={() => handleDeleteMessage(msg.id)} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-medium text-sm py-2 px-4 rounded-lg transition-colors">Ta bort</button>
                                </div>
                            </div>
                        ))}
                    </div>
                     <button onClick={handleCreateNew} className="mt-6 w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-primary hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all font-bold flex items-center justify-center gap-2">
                        <span className="text-xl">+</span> Skapa nytt meddelande
                    </button>
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
