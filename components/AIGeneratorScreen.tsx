
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Workout, Passkategori, CustomCategoryWithPrompt, StudioConfig, EquipmentItem } from '../types';
import { generateWorkout, parseWorkoutFromText } from '../services/geminiService';

// AIGeneratorScreen Component
interface AIGeneratorScreenProps {
  onWorkoutGenerated: (workout: Workout) => void;
  initialPrompt?: string;
  isFromBoost?: boolean;
  workouts: Workout[];
  onEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => Promise<void>;
  onTogglePublish: (workoutId: string, isPublished: boolean) => void;
  onCreateNewWorkout: () => void;
  initialMode?: 'generate' | 'parse' | 'manage' | 'create';
  studioConfig: StudioConfig;
  workoutsLoading: boolean;
  setCustomBackHandler: (handler: (() => void) | null) => void;
}

const SubViewWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-4 max-w-2xl mx-auto text-left">
        <h2 className="text-3xl font-bold text-center text-white mb-4">{title}</h2>
        {children}
    </div>
);


export const AIGeneratorScreen: React.FC<AIGeneratorScreenProps> = ({ 
    onWorkoutGenerated, 
    initialPrompt = '', 
    isFromBoost = false, 
    workouts, 
    onEditWorkout, 
    onDeleteWorkout,
    onTogglePublish,
    onCreateNewWorkout,
    initialMode = 'create',
    studioConfig,
    workoutsLoading,
    setCustomBackHandler
}) => {
  const [mode, setMode] = useState<'generate' | 'parse' | 'manage' | 'create'>(initialMode);
  
  const [selectedCategory, setSelectedCategory] = useState<CustomCategoryWithPrompt | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Set initial category if not coming from a boost/special prompt
    if (!initialPrompt && studioConfig.customCategories.length > 0) {
        setSelectedCategory(studioConfig.customCategories[0]);
    }
  }, [studioConfig, initialPrompt]);


  const [additionalInput, setAdditionalInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isGeneralMode = !initialPrompt;
  const currentBasePrompt = isGeneralMode ? (selectedCategory?.prompt || '') : initialPrompt;

  const unpublishedWorkouts = useMemo(() => workouts.filter(w => !w.isPublished), [workouts]);
  const publishedWorkouts = useMemo(() => workouts.filter(w => w.isPublished), [workouts]);

  const groupedUnpublishedWorkouts = useMemo(() => {
    return unpublishedWorkouts.reduce((acc, workout) => {
        const category = workout.category || 'Ej kategoriserad';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(workout);
        return acc;
    }, {} as Record<string, Workout[]>);
  }, [unpublishedWorkouts]);

  const sortedUnpublishedCategories = useMemo(() => Object.keys(groupedUnpublishedWorkouts).sort((a, b) => a.localeCompare(b)), [groupedUnpublishedWorkouts]);

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
        ...prev,
        [category]: !prev[category]
    }));
  };

  const handleBackToHub = useCallback(() => {
      setMode('create');
      setError(null);
      setAdditionalInput('');
      setPastedText('');
  }, []);

  useEffect(() => {
    if (mode !== 'create') {
        setCustomBackHandler(() => handleBackToHub);
    } else {
        setCustomBackHandler(null);
    }

    return () => {
        setCustomBackHandler(null);
    };
  }, [mode, handleBackToHub, setCustomBackHandler]);


  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let generatedData: Workout;
      const equipment = studioConfig.equipmentInventory || [];
      if (mode === 'parse') {
        if (!pastedText.trim()) {
          setError('Klistra in text för att tolka passet.');
          setIsLoading(false);
          return;
        }
        generatedData = await parseWorkoutFromText(pastedText, equipment);
      } else {
        let finalPrompt = currentBasePrompt;
        if (additionalInput.trim()) {
          finalPrompt += `\n\n**Ytterligare önskemål från coach:**\n${additionalInput}`;
        }
        if (!finalPrompt.trim()) {
          setError('Instruktionerna kan inte vara tomma.');
          setIsLoading(false);
          return;
        }
        generatedData = await generateWorkout(finalPrompt, equipment);
        
        // If a category was selected to generate the workout, assign it to the new workout.
        if (selectedCategory) {
            generatedData.category = selectedCategory.name;
        }
      }
      onWorkoutGenerated(generatedData);
    } catch (e) {
      const err = e as Error;
      setError(`Kunde inte generera pass: ${err.message}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDelete = async (workoutId: string, workoutTitle: string) => {
    if (window.confirm(`Är du säker på att du vill ta bort passet "${workoutTitle}" permanent? Detta kan inte ångras.`)) {
        await onDeleteWorkout(workoutId);
    }
  };

  const WorkoutListItem: React.FC<{ workout: Workout }> = ({ workout }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-200/50 dark:hover:bg-gray-700/80 transition-colors">
        <div className="text-left flex-grow">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{workout.title}</h3>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span>
                  Passkategori: <span className="font-semibold text-primary">{workout.category || 'Ej kategoriserad'}</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${workout.isPublished ? 'bg-primary text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {workout.isPublished ? 'Publicerat' : 'Ej publicerat'}
              </span>
            </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
          {workout.isPublished ? (
              <button
                  onClick={() => onTogglePublish(workout.id, false)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-4 rounded-lg transition-colors"
                  aria-label={`Avpublicera passet ${workout.title}`}
              >
                  Avpublicera
              </button>
          ) : (
              <button
                  onClick={() => onTogglePublish(workout.id, true)}
                  className="bg-primary hover:brightness-95 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  aria-label={`Publicera passet ${workout.title}`}
              >
                  Publicera
              </button>
          )}
          <button
              onClick={() => onEditWorkout(workout)}
              className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              aria-label={`Redigera passet ${workout.title}`}
          >
              Redigera
          </button>
          <button
              onClick={() => handleDelete(workout.id, workout.title)}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              aria-label={`Ta bort passet ${workout.title}`}
          >
              Ta bort
          </button>
        </div>
    </div>
  );
  
  const LoadingList = () => (
      <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900/50 p-4 rounded-lg flex justify-between items-center border border-gray-200 dark:border-gray-700 animate-pulse">
                  <div className="flex-grow">
                      <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="flex gap-2">
                      <div className="h-10 w-24 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                      <div className="h-10 w-24 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                  </div>
              </div>
          ))}
      </div>
  );

  const renderContent = () => {
    switch (mode) {
      case 'generate':
        return (
          <SubViewWrapper title="Skapa med AI">
              <p className="text-gray-500 dark:text-gray-400 text-center pb-2">
                {isFromBoost
                  ? "AI:n skapar nu en WOD baserat på din valda svårighetsgrad. Lägg till egna önskemål för att anpassa passet ytterligare."
                  : (isGeneralMode
                    ? "Välj en passtyp och lägg till egna önskemål för att skräddarsy resultatet."
                    : "AI:n kommer använda grundinstruktionerna nedan. Lägg till egna önskemål för att anpassa passet.")
                }
              </p>
              {isGeneralMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-left">Välj passtyp:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {studioConfig.customCategories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${selectedCategory?.id === cat.id ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!isFromBoost && (
                <div>
                    <div className="bg-white dark:bg-black p-4 rounded-md border border-gray-300 dark:border-gray-600 text-left text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto">
                        <p className="whitespace-pre-wrap">{currentBasePrompt}</p>
                    </div>
                </div>
              )}
              <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 text-left">Dina tillägg:</label>
                  <textarea
                    value={additionalInput}
                    onChange={(e) => setAdditionalInput(e.target.value)}
                    placeholder="Lägg till egna önskemål här, t.ex. specifik utrustning, tidslängd eller fokusområde."
                    className="w-full h-28 bg-white dark:bg-black text-gray-800 dark:text-white p-4 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    disabled={isLoading}
                  />
              </div>
              <EquipmentContext equipment={studioConfig.equipmentInventory} />
               <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-wait text-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="relative w-6 h-6">
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
                      </div>
                      <span>Genererar...</span>
                    </>
                  ) : (
                    'Skapa Pass med AI'
                  )}
                </button>
          </SubViewWrapper>
        );
      case 'parse':
        return (
          <SubViewWrapper title="Klistra in & Tolka Pass">
              <p className="text-gray-500 dark:text-gray-400 text-center pb-2">
                Klistra in ditt pass från Word, Excel eller anteckningar. AI:n kommer försöka tolka texten och strukturera upp den till ett komplett pass.
              </p>
              <div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Exempel:&#10;Block A&#10;3 varv&#10;10 Knäböj&#10;10 Armhävningar&#10;&#10;Block B&#10;AMRAP 10 min&#10;5 Burpees&#10;10 Svingar"
                  className="w-full h-48 bg-white dark:bg-black text-gray-800 dark:text-white p-4 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                  disabled={isLoading}
                />
              </div>
              <EquipmentContext equipment={studioConfig.equipmentInventory} />
              <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-wait text-lg"
                >
                  {isLoading ? (
                    <>
                       <div className="relative w-6 h-6">
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
                        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
                      </div>
                      <span>Tolkar...</span>
                    </>
                  ) : (
                    'Tolka & Strukturera Pass'
                  )}
                </button>
            </SubViewWrapper>
        );
      case 'manage':
        return (
          <div className="space-y-8 text-left">
                <div>
                    <h2 className="text-2xl font-bold text-white">Publicerade Studiopass</h2>
                    <p className="text-gray-400 mb-4 text-sm">
                        Dessa pass är synliga för medlemmar på hemskärmen under sin passkategori.
                    </p>
                    {workoutsLoading ? <LoadingList /> : publishedWorkouts.length > 0 ? (
                        <div className="space-y-3">
                            {publishedWorkouts.map(workout => (
                                <WorkoutListItem key={workout.id} workout={workout} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-white dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Det finns inga publicerade pass.</p>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-white">Sparade Pass (Utkast)</h2>
                    <p className="text-gray-400 mb-4 text-sm">
                        Pass som är sparade som utkast. Dessa är inte synliga för andra medlemmar på hemskärmen.
                    </p>
                    {workoutsLoading ? <LoadingList /> : sortedUnpublishedCategories.length > 0 ? (
                        <div className="space-y-3">
                            {sortedUnpublishedCategories.map(category => {
                                const workoutsInCategory = groupedUnpublishedWorkouts[category];
                                const isExpanded = !!expandedCategories[category];
                                return (
                                    <div key={category} className="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <button 
                                            onClick={() => toggleCategoryExpansion(category)}
                                            className="w-full flex justify-between items-center p-4 text-left"
                                            aria-expanded={isExpanded}
                                            aria-controls={`category-panel-${category}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">{category}</h3>
                                            </div>
                                            <span className="text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full">
                                                {workoutsInCategory.length} pass
                                            </span>
                                        </button>
                                        {isExpanded && (
                                            <div id={`category-panel-${category}`} className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3 animate-fade-in">
                                                {workoutsInCategory.map(workout => (
                                                    <WorkoutListItem key={workout.id} workout={workout} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-white dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Du har inga sparade utkast eller personliga pass.</p>
                        </div>
                    )}
                </div>
            </div>
        );
      case 'create':
      default:
        return (
            <div className="space-y-6 max-w-2xl mx-auto text-center py-10">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Bygg ett eget pass</h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Klicka nedan för att öppna passbyggaren och skapa ett helt nytt, skräddarsytt pass från grunden.
              </p>
              <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                      onClick={onCreateNewWorkout}
                      className="bg-primary hover:brightness-95 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                  >
                      Skapa nytt
                  </button>
                  <button
                      onClick={() => setMode('generate')}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                  >
                      Skapa med AI
                  </button>
                  <button
                      onClick={() => setMode('parse')}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                  >
                      Klistra in Pass
                  </button>
                  <button
                      onClick={() => setMode('manage')}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
                  >
                      Hantera Pass
                  </button>
              </div>
            </div>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="animate-fade-in">
          {renderContent()}
          {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  );
};

const EquipmentContext: React.FC<{ equipment?: EquipmentItem[] }> = ({ equipment }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!equipment || equipment.length === 0) return null;

    return (
        <div className="bg-white dark:bg-black p-3 rounded-md border border-gray-300 dark:border-gray-600 text-left text-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center font-semibold text-gray-700 dark:text-gray-300"
            >
                <span>Tillgänglig utrustning för AI:n</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && (
                <ul className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    {equipment.map(item => (
                        <li key={item.id} className="text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span> (x{item.quantity})
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};
