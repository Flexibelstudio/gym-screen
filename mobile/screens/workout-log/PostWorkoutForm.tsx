import React, { useState } from 'react';
import { InformationCircleIcon } from '../../../components/icons';
import { Modal } from '../../../components/ui/Modal';
import { uploadImage } from '../../../services/firebaseService';
import { resizeImage } from '../../../utils/imageUtils';
import { LogData } from './types';
import { KROPPSKANSLA_TAGS, RPE_LEVELS } from './utils';

export const PostWorkoutForm: React.FC<{ data: LogData; onUpdate: (updates: Partial<LogData>) => void; userId?: string; isSummerChallengeOn?: boolean; }> = ({ data, onUpdate, userId, isSummerChallengeOn = false }) => {
    const [showRpeInfo, setShowRpeInfo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const toggleTag = (tag: string) => onUpdate({ tags: data.tags.includes(tag) ? data.tags.filter(t => t !== tag) : [...data.tags, tag] });
    const getRpeColor = (num: number) => num <= 4 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : num <= 7 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const resized = await resizeImage(file, 800, 800, 0.8);
            const path = `workouts/${userId || 'unknown'}/workout_${Date.now()}.jpg`;
            const url = await uploadImage(path, resized);
            onUpdate({ imageUrl: url });
        } catch (err) {
            console.error("Upload image for workout failed:", err);
            alert("Det gick inte att ladda upp bilden. Försök igen!");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="mt-8 space-y-8 animate-fade-in">
            <div>
                <h4 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-6 leading-[1.2] pt-[0.1em]">Hur kändes passet?</h4>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-[1.2] pt-[0.1em]">Ansträngning (RPE 1-10)</h5>
                        <button onClick={() => setShowRpeInfo(true)} className="p-1.5 -m-1.5 text-gray-400 hover:text-primary transition-colors focus:ring-2 focus:ring-primary rounded-lg">
                            <InformationCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex justify-between gap-1 sm:gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button 
                                key={num} 
                                onClick={() => onUpdate({ rpe: num })} 
                                className={`flex-1 min-h-[44px] rounded-xl flex items-center justify-center font-black text-sm tabular-nums transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary ${data.rpe === num ? 'bg-primary text-white scale-105 shadow-md shadow-primary/30 z-10' : `${getRpeColor(num)} opacity-70 hover:opacity-100`}`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-10">
                    <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 leading-[1.2] pt-[0.1em]">Kroppskänsla</h5>
                    <div className="flex flex-wrap gap-2">
                        {KROPPSKANSLA_TAGS.map(tag => (
                            <button 
                                key={tag} 
                                onClick={() => toggleTag(tag)} 
                                className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary ${data.tags.includes(tag) ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* --- Sommarpepp Bild-uppladdning (visas endast under sommarutmaningen) --- */}
                {isSummerChallengeOn && (
                    <div className="mt-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center bg-gray-50/50 dark:bg-gray-900/10 hover:border-primary/50 transition-colors animate-fade-in">
                        <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 leading-[1.2] pt-[0.1em]">📸 Dela en sommarbild</h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto font-medium">Bifoga en bild till ditt pass så visas den i Sommarfeeden på SmartStudio och Topplistan! ☀️</p>
                        {data.imageUrl ? (
                            <div className="relative inline-block mt-2">
                                <img src={data.imageUrl} alt="Bifogad sommarbild" className="w-32 h-32 object-cover rounded-2xl shadow-md border-2 border-primary" />
                                <button 
                                    onClick={(e) => { e.preventDefault(); onUpdate({ imageUrl: '' }); }}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <label className={`cursor-pointer min-h-[44px] px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow hover:bg-primary dark:hover:bg-primary dark:hover:text-white hover:text-white active:scale-95 flex items-center gap-2 focus:ring-2 focus:ring-primary ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {isUploading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            Laddar upp...
                                        </>
                                    ) : (
                                        <>
                                            <span>Bifoga bild</span>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                                </label>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-10">
                    <h5 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 ml-1 leading-[1.2] pt-[0.1em]">Kommentar</h5>
                    <textarea value={data.comment} onChange={(e) => onUpdate({ comment: e.target.value })} placeholder="Anteckningar..." rows={4} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner font-medium" />
                </div>
            </div>
            <Modal isOpen={showRpeInfo} onClose={() => setShowRpeInfo(false)} title="Vad är RPE?" size="sm">
                <div className="space-y-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">RPE (Rate of Perceived Exertion) är en skala mellan 1-10 som hjälper dig att skatta din ansträngning.</p>
                    <div className="space-y-2">
                        {RPE_LEVELS.map(level => (
                            <div key={level.range} className="flex gap-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                <div className={`w-12 h-12 rounded-xl ${level.color} flex items-center justify-center text-white font-black tabular-nums flex-shrink-0 shadow-xs`}>{level.range}</div>
                                <div>
                                    <h6 className="font-bold text-gray-900 dark:text-white text-sm">{level.label}</h6>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{level.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowRpeInfo(false)} className="w-full min-h-[44px] bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-3.5 rounded-xl uppercase tracking-wider text-xs active:scale-95 transition-all">Jag förstår</button>
                </div>
            </Modal>
        </div>
    );
};
