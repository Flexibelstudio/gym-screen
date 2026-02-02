import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, DumbbellIcon, DocumentTextIcon, CloseIcon, VideoIcon } from './icons';
import { generateWorkout, parseWorkoutFromText, parseWorkoutFromImage, parseWorkoutFromYoutube } from '../services/geminiService';
import { Workout, WorkoutBlock, Exercise, StudioConfig, CustomCategoryWithPrompt } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { resizeImage } from '../utils/imageUtils';

// --- LOKALA KOMPONENTER FÖR ATT UNDVIKA KRASCH ---

const Spinner = () => (
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-white"></div>
);

// ---------------------------------------------------

interface AIGeneratorScreenProps {
    onWorkoutGenerated: (workout: Workout) => void;
    onEditWorkout?: (workout: Workout) => void; 
    onDeleteWorkout?: (id: string) => Promise<void>;
    onTogglePublish?: (id: string, val: boolean) => void;
    onCreateNewWorkout?: () => void;
    initialMode?: 'generate' | 'parse' | 'manage' | 'create' | 'youtube';
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
    
    // Determine initial active tab based on prop
    const [activeTab, setActiveTab] = useState<'generate' | 'parse' | 'youtube'>(
        initialMode === 'parse' ? 'parse' : initialMode === 'youtube' ? 'youtube' : 'generate'
    );

    const [prompt, setPrompt] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CustomCategoryWithPrompt | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedWorkout, setGeneratedWorkout] = useState<Workout | null>(null);
    
    // Image Handling State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Sync state if prop changes
    useEffect(() => {
        if (initialMode === 'parse' || initialMode === 'generate' || initialMode === 'youtube') {
            setActiveTab(initialMode as any);
        }
    }, [initialMode]);

    // Select first category by default if available
    useEffect(() => {
        if (studioConfig?.customCategories && studioConfig.customCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(studioConfig.customCategories[0]);
        }
    }, [studioConfig]);

    // --- Image Handling Logic ---
    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError("Endast bildfiler är tillåtna.");
            return;
        }
        setIsProcessing(true); // Temporary loading state for resize
        try {
            // Resize for optimal AI processing (max 1024px is usually sufficient)
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

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.stopPropagation();
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

    // ----------------------------

    const handleAction = async () => {
        setIsProcessing(true);
        setError(null);
        setGeneratedWorkout(null);

        try {
            let workout: Workout;

            if (activeTab === 'generate') {
                // Kombinera kategorins prompt med användarens tillägg
                let finalPrompt = prompt;
                if (selectedCategory) {
                    finalPrompt = `Skapa ett pass av typen "${selectedCategory.name}". 
                    Grundinstruktion för denna typ: "${selectedCategory.prompt}".
                    Användarens specifika önskemål/tillägg: "${prompt}"`;
                } else if (!prompt.trim()) {
                    throw new Error("Du måste välja en kategori eller skriva ett önskemål.");
                }

                // Generera nytt pass med AI
                const contextWorkouts = workouts.slice(0, 5); 
                workout = await generateWorkout(finalPrompt, contextWorkouts);
            } else if (activeTab === 'youtube') {
                if (!youtubeUrl.trim()) throw new Error("Ange en YouTube-länk.");
                if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
                    throw new Error("Ogiltig YouTube-adress.");
                }
                workout = await parseWorkoutFromYoutube(youtubeUrl.trim());
            } else {
                // PARSE MODE logic
                if (selectedImage) {
                    // Vision capabilities
                    const base64Data = selectedImage.split(',')[1];
                    workout = await parseWorkoutFromImage(base64Data, prompt);
                } else {
                    if (!prompt.trim()) throw new Error("Klistra in text eller ladda upp en bild för att tolka.");
                    // Text interpretation
                    workout = await parseWorkoutFromText(prompt);
                }
            }
            
            // --- SAFETY CHECK ---
            if (!workout) throw new Error("Inget pass returnerades.");

            const safeWorkout: Workout = {
                ...workout,
                id: workout.id || `ai-${Date.now()}`,
                organizationId: selectedOrganization?.id || 'unknown-org',
                title: workout.title || (activeTab === 'parse' ? 'Tolkat Pass' : activeTab === 'youtube' ? 'YouTube Pass' : 'Namnlöst AI-pass'),
                isPublished: false,
                isFavorite: false,
                createdAt: Date.now(),
                category: activeTab === 'generate' && selectedCategory ? selectedCategory.name : (workout.category || 'AI Genererat'),
                blocks: (workout.blocks || []).map((block: WorkoutBlock, bIdx: number) => ({
                    ...block,
                    id: block.id || `block-${Date.now()}-${bIdx}`,
                    title: block.title || 'Block',
                    exercises: (block.exercises || []).map((ex: Exercise, eIdx: number) => ({
                        ...ex,
                        id: ex.id || `ex-${Date.now()}-${bIdx}-${eIdx}`,
                        name: ex.name || 'Övning'
                    }))
                }))
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
                    {activeTab === 'generate' ? 'Skapa med AI' : activeTab === 'youtube' ? 'YouTube-Import' : 'Text- & Bildtolkaren'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    {activeTab === 'generate' 
                        ? 'Välj en passtyp och lägg till egna önskemål för att skräddarsy resultatet.' 
                        : activeTab === 'youtube'
                        ? 'Klistra in en YouTube-länk så analyserar jag videons struktur och övningar.'
                        : 'Klistra in text eller ladda upp en bild på ett pass så digitaliserar jag det.'}
                </p>
            </div>

            {/* Input Section */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-colors">
                
                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800 pb-4 overflow-x-auto scrollbar-hide">
                    <button 
                        onClick={() => setActiveTab('generate')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold whitespace-nowrap ${activeTab === 'generate' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Skapa nytt
                    </button>
                    <button 
                        onClick={() => setActiveTab('parse')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold whitespace-nowrap ${activeTab === 'parse' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <DocumentTextIcon className="w-5 h-5" />
                        Tolka text/bild
                    </button>
                    <button 
                        onClick={() => setActiveTab('youtube')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-bold whitespace-nowrap ${activeTab === 'youtube' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <VideoIcon className="w-5 h-5" />
                        YouTube-länk
                    </button>
                </div>

                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/60 z-20 flex flex-col items-center justify-center backdrop-blur-sm transition-colors">
                        <Spinner />
                        <p className="text-purple-600 dark:text-purple-300 mt-4 font-medium animate-pulse text-center px-6">
                            {activeTab === 'generate' ? 'Tänker så det knakar...' : activeTab === 'youtube' ? 'Analyserar videons innehåll och struktur...' : 'Tolkar och strukturerar...'}
                        </p>
                    </div>
                )}
                
                {/* CATEGORY SELECTOR (Only in generate mode) */}
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

                {/* YOUTUBE INPUT (Only in youtube mode) */}
                {activeTab === 'youtube' && (
                    <div className="mb-6 space-y-4">
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                            <InformationCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>Tips:</strong> AI:n fungerar bäst om videon har en tydlig beskrivning eller om övningarna visas tydligt. Passar perfekt för Hyrox-tips eller CrossFit WODs.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                YouTube URL:
                            </label>
                            <input 
                                type="url"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                            />
                        </div>
                    </div>
                )}

                {/* DROP ZONE (Only in parse mode) */}
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
                                    title="Ta bort bild"
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
                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                    T.ex. foto på whiteboard eller anteckningsblock
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab !== 'youtube' && (
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                            {activeTab === 'generate' ? 'Dina tillägg:' : (selectedImage ? 'Tillägg till bilden (valfritt):' : 'Klistra in texten här:')}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={activeTab === 'generate' 
                                ? "Lägg till egna önskemål här, t.ex. specifik utrustning, tidslängd eller fokusområde." 
                                : (selectedImage ? "T.ex. 'Ignorera uppvärmningen' eller 'Det är 4 varv'" : "Klistra in ditt pass här...\n\nUppvärmning:\n...")}
                            className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none min-h-[120px] text-base transition-colors placeholder-gray-400 dark:placeholder-gray-500"
                            disabled={isProcessing}
                        />
                    </div>
                )}
                
                <div className="mt-6 flex justify-between items-center">
                    {activeTab === 'generate' ? (
                        <div className="text-xs text-gray-500 italic hidden sm:block">
                            AI:n använder din valda kategori som grund.
                        </div>
                    ) : activeTab === 'youtube' ? (
                         <div className="text-xs text-gray-500 italic hidden sm:block">
                            Importen kan ta upp till 20 sekunder.
                        </div>
                    ) : (
                        <span className="text-xs text-gray-500 italic">Jag hittar automatiskt övningar, reps och tider.</span>
                    )}
                    
                    <button
                        onClick={handleAction}
                        disabled={isProcessing || (activeTab === 'generate' && !selectedCategory && !prompt.trim()) || (activeTab === 'parse' && !prompt.trim() && !selectedImage) || (activeTab === 'youtube' && !youtubeUrl.trim())}
                        className={`
                            ${activeTab === 'generate' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500' : activeTab === 'youtube' ? 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}
                            text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full sm:w-auto justify-center
                        `}
                    >
                        {activeTab === 'generate' ? <SparklesIcon className="w-5 h-5" /> : activeTab === 'youtube' ? <VideoIcon className="w-5 h-5" /> : <DocumentTextIcon className="w-5 h-5" />}
                        {activeTab === 'generate' ? 'Skapa Pass med AI' : activeTab === 'youtube' ? 'Analysera Video' : (selectedImage ? 'Tolka Bild' : 'Tolka Text')}
                    </button>
                </div>
                
                {error && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}
            </div>

            {/* Preview Section */}
            {generatedWorkout && (
                <div className="animate-slide-up space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 px-3 py-1 rounded-lg text-sm uppercase tracking-wider font-extrabold border border-blue-200 dark:border-blue-500/30">Förslag:</span> 
                            <span className="truncate max-w-[300px] sm:max-w-md">{generatedWorkout.title}</span>
                        </h3>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button 
                                onClick={() => setGeneratedWorkout(null)} 
                                className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 px-4 py-3 font-medium transition-colors"
                            >
                                Kasta
                            </button>
                            <button 
                                onClick={handleAccept} 
                                className="flex-grow sm:flex-grow-0 bg-white dark:bg-white text-black hover:bg-gray-100 font-black py-3 px-8 rounded-xl shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                            >
                                <span>Använd detta pass</span>
                                <span className="text-lg">&rarr;</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {generatedWorkout.blocks.map((block, i) => (
                            <div key={block.id || i} className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-purple-700 dark:text-purple-300 text-lg">{block.title}</h4>
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded uppercase font-bold tracking-wider">{block.settings?.mode || 'Standard'}</span>
                                </div>
                                <ul className="space-y-2">
                                    {(block.exercises || []).map((ex, j) => (
                                        <li key={ex.id || j} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                            <DumbbellIcon className="w-4 h-4 mt-0.5 text-gray-400 dark:text-gray-500 shrink-0" />
                                            <span>
                                                <strong className="text-gray-900 dark:text-white">{ex.name}</strong>
                                                {ex.reps && <span className="text-gray-500 mx-1">• {ex.reps}</span>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                {block.followMe && (
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500">
                                        <SparklesIcon className="w-3 h-3" />
                                        <span>Följ mig aktiverat</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};