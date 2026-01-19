
import React, { useState } from 'react';
import { StudioConfig, Organization, ThemeOption } from '../../types';
import { ToggleSwitch, SparklesIcon, InformationCircleIcon } from '../icons';
import { SelectField } from './AdminShared';
import { CategoryPromptManager } from '../CategoryPromptManager';
import { FeatureInfoModal } from './AdminModals';

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
    const [showFeatureInfo, setShowFeatureInfo] = useState(false);

    const handleAiChange = (field: 'instructions' | 'tone', value: string) => {
        handleUpdateConfigField('aiSettings', {
            ...(config.aiSettings || {}),
            [field]: value
        });
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
                                label="HYROX-modul" 
                                checked={!!config.enableHyrox} 
                                onChange={(checked) => handleUpdateConfigField('enableHyrox', checked)} 
                            />
                            <p className="text-xs text-gray-500 mt-2 pl-2">Aktiverat verktyg för tävlingar och HYROX-pass.</p>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <ToggleSwitch 
                                    label="Medlemsupplevelse & Loggning" 
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
                                Låser upp medlemsappen, träningsdagbok, AI-coach och medlemsregister.
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
                                    AI-Coach Inställningar
                                </h4>
                                <div className="space-y-4">
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
                                            className="w-full p-2 text-sm rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none"
                                        >
                                            <option value="neutral">Neutral & Professionell</option>
                                            <option value="enthusiastic">Peppande & Entusiastisk</option>
                                            <option value="strict">Sträng & Militärisk</option>
                                            <option value="sales">Säljande & Serviceinriktad</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-5 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <ToggleSwitch label="Idé-tavlan (Whiteboard)" checked={!!config.enableNotes} onChange={(checked) => handleUpdateConfigField('enableNotes', checked)} />
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
                    <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Säsong & Tema</h4>
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
