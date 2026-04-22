
import React, { useState } from 'react';
import { StudioConfig, Organization, ThemeOption, TimerSoundProfile } from '../../types';
import { ToggleSwitch, SparklesIcon, InformationCircleIcon, SpeakerphoneIcon } from '../icons';
import { SelectField } from './AdminShared';
import { CategoryPromptManager } from '../CategoryPromptManager';
import { FeatureInfoModal } from './AdminModals';
import { saveAdminActivity } from '../../services/firebaseService';
import { useAuth } from '../../context/AuthContext';
import { playTimerSound } from '../../hooks/useWorkoutTimer';

interface GlobalSettingsContentProps {
    organization: Organization;
    config: StudioConfig;
    isSavingConfig: boolean;
    isConfigDirty: boolean;
    handleUpdateConfigField: <K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => void;
    handleSaveConfig: (configOverride?: StudioConfig) => Promise<void>;
    onTriggerUpgrade: () => void;
}

export const GlobalSettingsContent: React.FC<GlobalSettingsContentProps> = ({ 
    config, isSavingConfig, isConfigDirty, handleUpdateConfigField, handleSaveConfig, organization, onTriggerUpgrade 
}) => {
    const { userData } = useAuth();
    const [showFeatureInfo, setShowFeatureInfo] = useState(false);

    const handleAiChange = (field: 'instructions' | 'tone', value: string) => {
        handleUpdateConfigField('aiSettings', {
            ...(config.aiSettings || {}),
            [field]: value
        });
    };

    const handleTestSound = () => {
        const sound = config.soundProfile || 'airhorn';
        playTimerSound(sound, 2); // Play twice
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Globala Inställningar</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Dessa inställningar gäller som standard för alla skärmar.</p>
                </div>
                <button onClick={() => handleSaveConfig()} disabled={!isConfigDirty || isSavingConfig} className="bg-primary hover:brightness-95 text-white font-semibold py-2.5 px-6 rounded-xl disabled:opacity-50 shadow-sm transition-all transform active:scale-95">
                    {isSavingConfig ? 'Sparar...' : 'Spara Ändringar'}
                </button>
            </div>

            <div className="p-6 sm:p-8 space-y-8">
                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Funktioner & Moduler</h4>
                    <div className="space-y-4">
                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="Fristående Timer" 
                                checked={config.enableTimer !== false} // Default true
                                onChange={(checked) => handleUpdateConfigField('enableTimer', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverar den fristående timern på startsidan.</p>
                        </div>

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="Övriga Pass" 
                                checked={config.enableOtherWorkouts !== false} // Default true
                                onChange={(checked) => handleUpdateConfigField('enableOtherWorkouts', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Visar knappen för "Övriga Pass" på startsidan.</p>
                        </div>

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="Träningslekar (Smart Play)" 
                                checked={!!config.enableWorkoutGames} 
                                onChange={(checked) => handleUpdateConfigField('enableWorkoutGames', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverar kortlekar, tärningar och andra träningsspel på skärmen.</p>
                        </div>

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch 
                                label="HYROX-modul" 
                                checked={!!config.enableHyrox} 
                                onChange={(checked) => handleUpdateConfigField('enableHyrox', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverat verktyg för tävlingar och HYROX-pass.</p>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <ToggleSwitch 
                                    label="Medlemsupplevelse & Loggning (BETA)" 
                                    checked={!!config.enableWorkoutLogging} 
                                    onChange={(checked) => {
                                        if (checked) onTriggerUpgrade();
                                        else handleUpdateConfigField('enableWorkoutLogging', false);
                                    }} 
                                />
                                <button 
                                    onClick={() => setShowFeatureInfo(true)}
                                    className="text-gray-400 hover:text-primary transition-colors"
                                    title="Läs mer om denna funktion"
                                >
                                    <InformationCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 pl-2">
                                <strong className="text-purple-600 dark:text-purple-400">Early Access:</strong> Låser upp medlemsappen, träningsdagbok, AI-coach och medlemsregister.
                            </p>
                            {!config.enableWorkoutLogging && (
                                <button onClick={onTriggerUpgrade} className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-2 pl-2 hover:underline">
                                    📊 Räkna på din vinst & läs mer...
                                </button>
                            )}
                        </div>

                        {config.enableWorkoutLogging && (
                            <div className="ml-8 p-4 bg-white dark:bg-black/20 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-fade-in">
                                <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <SparklesIcon className="w-4 h-4 text-purple-500" />
                                    AI-Coach & Loggning
                                </h4>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Systeminstruktioner</label>
                                        <textarea 
                                            rows={3}
                                            value={config.aiSettings?.instructions || ''}
                                            onChange={(e) => handleAiChange('instructions', e.target.value)}
                                            placeholder="T.ex: Påminn alltid om att boka PT om resultaten planar ut..."
                                            className="w-full p-2 text-sm rounded bg-gray-5 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tonläge</label>
                                        <select 
                                            value={config.aiSettings?.tone || 'neutral'}
                                            onChange={(e) => handleAiChange('tone', e.target.value)}
                                            className="w-full p-2 text-sm rounded bg-gray-5 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="neutral">Neutral & Professionell</option>
                                            <option value="enthusiastic">Peppande & Entusiastisk</option>
                                            <option value="strict">Sträng & Militärisk</option>
                                            <option value="sales">Säljande & Serviceinriktad</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 border-t border-blue-100 dark:border-blue-900/30">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pass för egen loggning (Vanliga val)</label>
                                        <p className="text-xs text-gray-400 mb-3">Dessa aktiviteter visas som snabbval när medlemmen loggar egenträning.</p>
                                        
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {(config.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"]).map((act, i) => (
                                                <div key={i} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700">
                                                    <span className="text-gray-700 dark:text-gray-300">{act}</span>
                                                    <button onClick={() => {
                                                        const curr = config.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"];
                                                        handleUpdateConfigField('commonActivities', curr.filter((_, idx) => idx !== i));
                                                    }} className="text-gray-400 hover:text-red-500 ml-1.5 font-bold transition-colors">
                                                        &times;
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <input 
                                                id="new-activity-input" 
                                                type="text" 
                                                placeholder="T.ex. Padel" 
                                                className="flex-1 p-2 text-sm rounded bg-gray-5 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none" 
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const target = e.currentTarget;
                                                        const val = target.value.trim();
                                                        if (val) {
                                                            const curr = config.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"];
                                                            if (!curr.includes(val)) handleUpdateConfigField('commonActivities', [...curr, val]);
                                                            target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button onClick={() => {
                                                const input = document.getElementById('new-activity-input') as HTMLInputElement;
                                                if (!input) return;
                                                const val = input.value.trim();
                                                if (val) {
                                                    const curr = config.commonActivities || ["Funktionell Träning", "HIIT", "Löpning", "Promenad", "Workout", "Yoga", "Cykling", "Simning", "Racketsport", "Vardagsmotion", "Styrketräning"];
                                                    if (!curr.includes(val)) handleUpdateConfigField('commonActivities', [...curr, val]);
                                                    input.value = '';
                                                }
                                            }} className="bg-primary hover:brightness-110 transition-all text-white text-sm px-4 py-2 rounded-md font-bold">
                                                Lägg till
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="AI Whiteboard" checked={!!config.enableNotes} onChange={(checked) => handleUpdateConfigField('enableNotes', checked)} />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Digital rityta för att skissa pass och idéer.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="Övningsbank" checked={!!config.enableExerciseBank} onChange={(checked) => handleUpdateConfigField('enableExerciseBank', checked)} />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Ger coacher tillgång till det gemensamma övningsbiblioteket.</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <ToggleSwitch label="Skärmsläckare" checked={!!config.enableScreensaver} onChange={(checked) => handleUpdateConfigField('enableScreensaver', checked)} />
                                {config.enableScreensaver && (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="60"
                                            value={config.screensaverTimeoutMinutes || 15} 
                                            onChange={(e) => handleUpdateConfigField('screensaverTimeoutMinutes', parseInt(e.target.value) || 15)}
                                            className="w-16 bg-white dark:bg-gray-800 text-center p-1 rounded border border-gray-300 dark:border-gray-600 text-sm"
                                        />
                                        <span className="text-xs text-gray-500">min</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 pl-2">Visar logotyp och klocka vid inaktivitet.</p>
                        </div>
                    </div>
                </section>

                <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Ljud & Tema</h4>
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Timerljud</label>
                            <div className="flex items-center gap-3">
                                <select
                                    value={config.soundProfile || 'airhorn'}
                                    onChange={(e) => handleUpdateConfigField('soundProfile', e.target.value as TimerSoundProfile)}
                                    className="flex-grow bg-white dark:bg-black text-black dark:text-white p-3 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                    <option value="airhorn">CrossFit-tutan (Aggressiv)</option>
                                    <option value="digital">Digital (Klassiskt Pip)</option>
                                    <option value="boxing">Boxningsklocka (Old School)</option>
                                    <option value="gong">Gong (Mjuk & Djup)</option>
                                </select>
                                <button 
                                    onClick={handleTestSound}
                                    className="p-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
                                    title="Provlyssna"
                                >
                                    <SpeakerphoneIcon className="w-5 h-5 text-gray-700 dark:text-white" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <SelectField 
                                label="Säsongstema" 
                                value={config.seasonalTheme || 'none'} 
                                onChange={(val) => handleUpdateConfigField('seasonalTheme', val as ThemeOption)}
                            >
                                <option value="none">Inget tema (Standard)</option>
                                <option value="auto">Automatiskt (Datumstyrt)</option>
                                <option value="winter">Vinter ❄️</option>
                                <option value="christmas">Jul 🎄</option>
                                <option value="newyear">Nyår 🎆</option>
                                <option value="valentines">Alla Hjärtans ❤️</option>
                                <option value="easter">Påsk 🐣</option>
                                <option value="midsummer">Midsommar 🌸</option>
                                <option value="summer">Sommar ☀️</option>
                                <option value="halloween">Halloween 🎃</option>
                            </SelectField>
                            <p className="text-xs text-gray-500 mt-2">
                                Lägger till subtila visuella effekter (t.ex. snö, konfetti) ovanpå din befintliga design.
                            </p>
                        </div>
                        
                         <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <SelectField 
                                label="Navigering (Knappar)" 
                                value={config.navigationControlPosition || 'top'} 
                                onChange={(val) => handleUpdateConfigField('navigationControlPosition', val as 'top' | 'bottom')}
                            >
                                <option value="top">Överkant (Standard)</option>
                                <option value="bottom">Nederkant (För höga skärmar)</option>
                            </SelectField>
                            <p className="text-xs text-gray-500 mt-2">
                                Bestämmer om tillbaka-knappar ska placeras högst upp eller längst ner på skärmen. Bra om skärmarna är monterade högt.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                <section>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Passkategorier</h4>
                    <CategoryPromptManager
                        categories={config.customCategories}
                        onCategoriesChange={(newCats) => handleUpdateConfigField('customCategories', newCats)}
                        isSaving={isSavingConfig}
                    />
                </section>
            </div>
            
            <FeatureInfoModal isOpen={showFeatureInfo} onClose={() => setShowFeatureInfo(false)} />
        </div>
    );
};
