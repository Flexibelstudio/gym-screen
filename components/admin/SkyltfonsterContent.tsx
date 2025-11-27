
import React, { useState, useEffect } from 'react';
import { Organization, DisplayWindow, DisplayPost, Studio } from '../../types';
import { ToggleSwitch } from '../icons';
import { InputField, SelectField, ImageUploaderForBanner, TextareaField, CheckboxField } from './AdminShared';

interface SkyltfonsterContentProps {
    organization: Organization;
    onUpdateDisplayWindows: (organizationId: string, displayWindows: DisplayWindow[]) => Promise<void>;
}

const DisplayPostForm: React.FC<{
    post: DisplayPost;
    onSave: (post: DisplayPost) => void;
    onCancel: () => void;
    studios: Studio[];
    organizationId: string;
}> = ({ post, onSave, onCancel, studios, organizationId }) => {
    const [formData, setFormData] = useState<DisplayPost>(post);

    const handleInputChange = (field: keyof DisplayPost, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleStudioVisibilityChange = (studioId: string, checked: boolean) => {
        let newVisibleInStudios = [...formData.visibleInStudios];
        const isAllChecked = newVisibleInStudios.includes('all');

        if (studioId === 'all') {
            newVisibleInStudios = checked ? ['all', ...studios.map(s => s.id)] : [];
        } else {
            if (checked) { newVisibleInStudios.push(studioId); } 
            else { newVisibleInStudios = newVisibleInStudios.filter(id => id !== studioId); }
            
            const allIndividualChecked = studios.every(s => newVisibleInStudios.includes(s.id));
            if (allIndividualChecked && !isAllChecked) { newVisibleInStudios.push('all'); } 
            else if (!allIndividualChecked && isAllChecked) { newVisibleInStudios = newVisibleInStudios.filter(id => id !== 'all'); }
        }
        handleInputChange('visibleInStudios', [...new Set(newVisibleInStudios)]);
    };

    const showImage = ['image-fullscreen', 'image-left'].includes(formData.layout);
    const showVideo = formData.layout === 'video-fullscreen';
    const showText = ['text-only', 'image-fullscreen', 'image-left'].includes(formData.layout);

    return (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{post.internalTitle === 'Nytt inlägg' ? 'Skapa nytt inlägg' : `Redigera: ${post.internalTitle}`}</h3>

            <InputField label="Intern titel" value={formData.internalTitle} onChange={val => handleInputChange('internalTitle', val)} required />
            <SelectField label="Layout" value={formData.layout} onChange={val => handleInputChange('layout', val)}>
                <option value="text-only">Endast text</option>
                <option value="image-fullscreen">Helskärmsbild med text</option>
                <option value="video-fullscreen">Helskärmsvideo</option>
                <option value="image-left">Bild till vänster</option>
            </SelectField>

            {showImage && <ImageUploaderForBanner imageUrl={formData.imageUrl || null} onImageChange={url => handleInputChange('imageUrl', url)} organizationId={organizationId} />}
            {showVideo && <InputField label="Video-URL" value={formData.videoUrl || ''} onChange={val => handleInputChange('videoUrl', val)} placeholder="https://.../video.mp4" />}
            {showText && (
                <>
                    <InputField label="Rubrik (frivillig)" value={formData.headline || ''} onChange={val => handleInputChange('headline', val)} />
                    <TextareaField label="Brödtext (frivillig)" value={formData.body || ''} onChange={val => handleInputChange('body', val)} />
                    <ToggleSwitch label="Inaktivera mörk text-overlay på helskärmsbild" checked={!!formData.disableOverlay} onChange={val => handleInputChange('disableOverlay', val)} />
                </>
            )}
            
            <InputField label="Visningstid (sekunder)" type="number" value={String(formData.durationSeconds)} onChange={val => handleInputChange('durationSeconds', Number(val))} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Startdatum (frivilligt)" type="date" value={formData.startDate || ''} onChange={val => handleInputChange('startDate', val)} />
                <InputField label="Slutdatum (frivilligt)" type="date" value={formData.endDate || ''} onChange={val => handleInputChange('endDate', val)} />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Synlighet</label>
                <div className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg space-y-2">
                    <CheckboxField label="Alla skärmar" checked={formData.visibleInStudios.includes('all')} onChange={checked => handleStudioVisibilityChange('all', checked)} />
                    {studios.map(studio => (
                        <CheckboxField key={studio.id} label={studio.name} checked={formData.visibleInStudios.includes('all') || formData.visibleInStudios.includes(studio.id)} onChange={checked => handleStudioVisibilityChange(studio.id, checked)} />
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-slate-300 dark:border-gray-700">
                <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg">Avbryt</button>
                <button onClick={() => onSave(formData)} className="bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg">Spara inlägg</button>
            </div>
        </div>
    );
};

const DisplayPostEditor: React.FC<{
    windowData: DisplayWindow,
    onSaveWindow: (window: DisplayWindow) => void,
    onBack: () => void,
    studios: Studio[],
    organizationId: string
}> = ({ windowData, onSaveWindow, onBack, studios, organizationId }) => {
    const [localWindow, setLocalWindow] = useState(windowData);
    const [editingPost, setEditingPost] = useState<DisplayPost | null>(null);

    const handleCreateNewPost = () => {
        setEditingPost({
            id: `post-${Date.now()}`,
            internalTitle: 'Nytt inlägg',
            layout: 'image-fullscreen',
            durationSeconds: 15,
            visibleInStudios: ['all'],
            posts: [],
        } as unknown as DisplayPost); // Quick fix for type mismatch
    };

    const handleSavePost = (postToSave: DisplayPost) => {
        const isNew = !localWindow.posts.some(p => p.id === postToSave.id);
        const newPosts = isNew
            ? [...localWindow.posts, postToSave]
            : localWindow.posts.map(p => p.id === postToSave.id ? postToSave : p);
        const updatedWindow = { ...localWindow, posts: newPosts };
        setLocalWindow(updatedWindow);
        onSaveWindow(updatedWindow);
        setEditingPost(null);
    };

    const handleDeletePost = (postId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort detta inlägg?")) {
            const updatedWindow = { ...localWindow, posts: localWindow.posts.filter(p => p.id !== postId) };
            setLocalWindow(updatedWindow);
            onSaveWindow(updatedWindow);
        }
    };
    
    if (editingPost) {
        return <DisplayPostForm post={editingPost} onSave={handleSavePost} onCancel={() => setEditingPost(null)} studios={studios} organizationId={organizationId} />;
    }

    return (
        <div className="space-y-4 animate-fade-in">
            <button onClick={onBack} className="text-primary font-semibold mb-4">&larr; Tillbaka till alla skyltfönster</button>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Redigera inlägg för "{localWindow.name}"</h3>
            
            <div className="space-y-3">
                {localWindow.posts.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">Inga inlägg har skapats ännu.</p>
                ) : localWindow.posts.map(post => (
                    <div key={post.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-slate-300 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-white">{post.internalTitle}</p>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setEditingPost(post)} className="text-primary hover:underline font-semibold">Redigera</button>
                            <button onClick={() => handleDeletePost(post.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={handleCreateNewPost} className="mt-4 bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg">
                Skapa nytt inlägg
            </button>
        </div>
    );
};

export const SkyltfonsterContent: React.FC<SkyltfonsterContentProps> = ({ organization, onUpdateDisplayWindows }) => {
    const [localWindows, setLocalWindows] = useState<DisplayWindow[]>([]);
    const [editingWindow, setEditingWindow] = useState<DisplayWindow | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalWindows(JSON.parse(JSON.stringify(organization.displayWindows || [])));
    }, [organization.displayWindows]);

    const handleUpdateAndSave = async (updatedWindows: DisplayWindow[]) => {
        setLocalWindows(updatedWindows);
        setIsSaving(true);
        try {
            await onUpdateDisplayWindows(organization.id, updatedWindows);
        } catch (error) {
            alert("Kunde inte spara ändringar.");
            // Revert on error
            setLocalWindows(JSON.parse(JSON.stringify(organization.displayWindows || [])));
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleWindowChange = (updatedWindow: DisplayWindow) => {
        const newWindows = localWindows.map(w => w.id === updatedWindow.id ? updatedWindow : w);
        handleUpdateAndSave(newWindows);
    };

    const handleCreateNewWindow = () => {
        const newWindow: DisplayWindow = {
            id: `window-${Date.now()}`,
            name: 'Nytt Skyltfönster',
            isEnabled: true,
            posts: []
        };
        handleUpdateAndSave([...localWindows, newWindow]);
    };

    const handleDeleteWindow = (windowId: string) => {
        if (window.confirm("Är du säker på att du vill ta bort hela detta skyltfönster med allt dess innehåll?")) {
            handleUpdateAndSave(localWindows.filter(w => w.id !== windowId));
        }
    };
    
    const handleRenameWindow = (window: DisplayWindow) => {
        const newName = prompt("Ange nytt namn för skyltfönstret:", window.name);
        if (newName && newName.trim() !== '') {
            handleWindowChange({ ...window, name: newName.trim() });
        }
    };

    if (editingWindow) {
        return (
            <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
                <DisplayPostEditor
                    windowData={editingWindow}
                    onSaveWindow={handleWindowChange}
                    onBack={() => setEditingWindow(null)}
                    studios={organization.studios}
                    organizationId={organization.id}
                />
            </div>
        );
    }

    return (
        <div className="bg-slate-100 dark:bg-gray-800 p-6 rounded-lg space-y-4 border border-slate-200 dark:border-gray-700">
            <div className="pb-3 mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Skyltfönster</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Hantera digitala anslagstavlor som kan visas på valfri skärm i studion.</p>
            </div>
            {localWindows.length === 0 ? (
                <div className="text-center p-8 bg-slate-200 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-gray-500">Inga skyltfönster har skapats ännu.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {localWindows.map(win => (
                        <div key={win.id} className="bg-slate-200 dark:bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-slate-300 dark:border-gray-700">
                            <p className="font-semibold text-gray-900 dark:text-white flex-grow">{win.name}</p>
                            <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Aktiv:</span>
                                <ToggleSwitch checked={win.isEnabled} onChange={checked => handleWindowChange({ ...win, isEnabled: checked })} label="" />
                                <button onClick={() => handleRenameWindow(win)} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg">Byt namn</button>
                                <button onClick={() => setEditingWindow(win)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg">Redigera inlägg</button>
                                <button onClick={() => handleDeleteWindow(win.id)} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg">Ta bort</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
             <button onClick={handleCreateNewWindow} className="mt-4 bg-primary hover:brightness-95 text-white font-bold py-3 px-6 rounded-lg">
                Skapa nytt skyltfönster
            </button>
        </div>
    );
};
