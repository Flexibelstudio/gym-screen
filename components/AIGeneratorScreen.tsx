import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, DumbbellIcon, DocumentTextIcon, CloseIcon } from './icons';
import { generateWorkout, parseWorkoutFromText, parseWorkoutFromImage } from '../services/geminiService';
import { Workout, WorkoutBlock, Exercise, StudioConfig, CustomCategoryWithPrompt } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { resizeImage } from '../utils/imageUtils';

const Spinner = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-white"></div>
);

interface AIGeneratorScreenProps {
    onWorkoutGenerated: (workout: Workout) => void;
    onEditWorkout?: (workout: Workout) => void; 
    onDeleteWorkout?: (id: string) => Promise<void>;
    onTogglePublish?: (id: string, val: boolean) => void;
    onCreateNewWorkout?: () => void;
    initialMode?: 'generate' | 'parse' | 'manage' | 'create';
    studioConfig?: StudioConfig;
    setCustomBackHandler?: (fn: any) => void;
    workouts?: Workout[];
    workoutsLoading?: boolean;
    initialExpandedCategory?: string | null;
}

export const AIGeneratorScreen: React.FC<AIGeneratorScreenProps> = ({ 
    onWorkoutGenerated,
    initialMode = 'generate',
    workouts = [],
    studioConfig
}) => {
    const { selectedOrganization } = useStudio();
    const [activeTab, setActiveTab] = useState<'generate' | 'parse'>(
        initialMode === 'parse' ? 'parse' : 'generate'
    );

    const [prompt, setPrompt] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CustomCategoryWithPrompt | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedWorkout, setGeneratedWorkout] = useState<Workout | null>(null);
    
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (initialMode === 'parse' || initialMode === 'generate') {
            setActiveTab(initialMode);
        }
    }, [initialMode]);

    useEffect(() => {
        if (studioConfig?.customCategories && studioConfig.customCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(studioConfig.customCategories[0]);
        }
    }, [studioConfig]);

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError("Endast bildfiler är tillåtna.");
            return;
        }
        setIsProcessing(true);
        try {
            const base64 = await resizeImage(file, 1024, 1024, 0.8);
            setSelectedImage(base64);
            setError(null);
        } catch (err) {
            console.error("Image processing error", err);
            setError("Kunde inte läsa bilden.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if(activeTab === 'parse') setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (activeTab === 'parse' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleAction = async () => {
        if (!selectedOrganization) {
            setError("Ingen organisation vald. Logga ut och in igen.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setGeneratedWorkout(null);

        try {
            let workout: Workout;
            const orgId = selectedOrganization.id;

            if (activeTab === 'generate') {
                let finalPrompt = prompt;
                if (selectedCategory) {
                    finalPrompt = `Skapa ett pass av typen "${selectedCategory.name}". 
                    Grundinstruktion för denna typ: "${selectedCategory.prompt}".
                    Användarens specifika önskemål/tillägg: "${prompt}"`;
                } else if (!prompt.trim()) {
                    throw new Error("Du måste välja en kategori eller skriva ett önskemål.");
                }

                const contextWorkouts = workouts.slice(0, 5); 
                workout = await generateWorkout(finalPrompt, orgId, contextWorkouts);
            } else {
                if (selectedImage) {
                    const base64Data = selectedImage.split(',')[1];
                    workout = await parseWorkoutFromImage(base64Data, orgId, prompt);
                } else {
                    if (!prompt.trim()) throw new Error("Klistra in text eller ladda upp en bild för att tolka.");
                    workout = await parseWorkoutFromText(prompt, orgId);
                }
            }
            
            if (!workout) throw new Error("Inget pass returnerades.");

            const safeWorkout: Workout = {
                ...workout,
                organizationId: orgId,
                category: activeTab === 'generate' && selectedCategory ? selectedCategory.name : (workout.category || 'AI Genererat'),
            };

            setGeneratedWorkout(safeWorkout);
        } catch (err) {
            console.error("AI/Parsing failed:", err);
            setError(err instanceof Error ? err.message : "Ett fel uppstod.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAccept = () => {
        if (generatedWorkout) {
            onWorkoutGenerated(generatedWorkout);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-600">
                    {activeTab === 'generate' ? 'Skapa med AI' : 'Text- & Bildtolkaren'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {activeTab === 'generate' 
                        ? 'Välj en passtyp och lägg till egna önskemål för att skräddarsy resultatet.' 
                        : 'Klistra in text eller ladda upp en bild på ett pass så digitaliserar jag det.'}
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-colors">
                <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                    <button 
                        onClick={() => setActiveTab('generate')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold ${activeTab === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Skapa nytt
                    </button>
                    <button 
                        onClick={() => setActiveTab('parse')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold ${activeTab === 'parse' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <DocumentTextIcon className="w-5 h-5" />
                        Tolka text/bild
                    </button>
                </div>

                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/60 z-20 flex flex-col items-center justify-center backdrop-blur-sm transition-colors">
                        <Spinner />
                        <p className="text-purple-600 dark:text-purple-300 mt-4 font-medium animate-pulse">
                            {activeTab === 'generate' ? 'Tänker så det knakar...' : 'Tolkar och strukturerar...'}
                        </p>
                    </div>
                )}
                
                {activeTab === 'generate' && studioConfig?.customCategories && (
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                            Välj passtyp:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {studioConfig.customCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-sm
                                        ${selectedCategory?.id === cat.id 
                                            ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-gray-900' 
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}
                                    `}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'parse' && (
                    <div 
                        ref={dropZoneRef}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !selectedImage && fileInputRef.current?.click()}
                        className={`
                            mb-6 w-full p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center min-h-[120px] relative
                            ${isDragging 
                                ? 'border-primary bg-primary/10 scale-[1.01]' 
                                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800/50'}
                        `}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={(e) => { if(e.target.files && e.target.files[0]) handleFile(e.target.files[0]) }} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        
                        {selectedImage ? (
                            <div className="relative w-full h-48 group" onClick={(e) => e.stopPropagation()}>
                                <img src={selectedImage} alt="Uppladdad" className="w-full h-full object-contain rounded-lg" />
                                <button 
                                    onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                                    className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="text-center pointer-events-none">
                                <div className="mx-auto w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 font-bold text-sm">
                                    {isDragging ? 'Släpp bilden här!' : 'Klicka eller dra en bild hit'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                        {activeTab === 'generate' ? 'Dina tillägg:' : (selectedImage ? 'Tillägg till bilden (valfritt):' : 'Klistra in texten här:')}
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={activeTab === 'generate' 
                            ? "Lägg till egna önskemål här..." 
                            : "Klistra in ditt pass här..."}
                        className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none min-h-[120px] text-base transition-colors"
                        disabled={isProcessing}
                    />
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleAction}
                        disabled={isProcessing || (activeTab === 'generate' && !selectedCategory && !prompt.trim()) || (activeTab === 'parse' && !prompt.trim() && !selectedImage)}
                        className={`
                            ${activeTab === 'generate' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}
                            text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-2
                        `}
                    >
                        {activeTab === 'generate' ? 'Skapa Pass med AI' : 'Tolka'}
                    </button>
                </div>
                
                {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}
            </div>

            {generatedWorkout && (
                <div className="animate-slide-up space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Förslag: {generatedWorkout.title}
                        </h3>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button onClick={() => setGeneratedWorkout(null)} className="text-gray-500 hover:text-red-500 px-4 py-3 font-medium transition-colors">Kasta</button>
                            <button onClick={handleAccept} className="flex-grow sm:flex-grow-0 bg-white dark:bg-white text-black hover:bg-gray-100 font-black py-3 px-8 rounded-xl shadow-xl transition-all transform hover:scale-105">Använd detta pass &rarr;</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};