



import React, { useState, useMemo, useEffect } from 'react';
import { Workout, Passkategori, CustomCategoryWithPrompt, StudioConfig } from '../types';
import { generateWorkout, parseWorkoutFromText } from '../services/geminiService';

// AIGeneratorScreen Component
interface AIGeneratorScreenProps {
  onWorkoutGenerated: (workout: Workout) => void;
  initialPrompt?: string;
  isFromBoost?: boolean;
  workouts: Workout[];
  onEditWorkout: (workout: Workout) => void;
  onDeleteWorkout: (workoutId: string) => Promise<void>;
  onCreateNewWorkout: () => void;
  initialMode?: 'generate' | 'parse' | 'manage' | 'create';
  studioConfig: StudioConfig;
  workoutsLoading: boolean;
}

export const AIGeneratorScreen: React.FC<AIGeneratorScreenProps> = ({ 
    onWorkoutGenerated, 
    initialPrompt = '', 
    isFromBoost = false, 
    workouts, 
    onEditWorkout, 
    onDeleteWorkout,
    onCreateNewWorkout,
    initialMode = 'create',
    studioConfig,
    workoutsLoading
}) => {
  const [mode, setMode] = useState<'generate' | 'parse' | 'manage' | 'create'>(initialMode);
  
  const [selectedCategory, setSelectedCategory] = useState<CustomCategoryWithPrompt | null>(null);
  
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


  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let generatedData: Workout;
      if (mode === 'parse') {
        if (!pastedText.trim()) {
          setError('Klistra in text för att tolka passet.');
          setIsLoading(false);
          return;
        }
        generatedData = await parseWorkoutFromText(pastedText);
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
        generatedData = await generateWorkout(finalPrompt);
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
    <div className="bg-white dark:bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-200/50 dark:hover:bg-gray-900/80 transition-colors">
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

  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
        Pass & Program
      </h1>
      
      <div className="bg-gray-100 dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
        {/* --- TABS --- */}
        <div className="flex border-b border-gray-300 dark:border-gray-600">
          <button 
            onClick={() => setMode('create')} 
            className={`flex-1 py-2 text-lg font-semibold transition-colors ${mode === 'create' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
          >
            Skapa Nytt
          </button>
          <button 
            onClick={() => setMode('generate')} 
            className={`flex-1 py-2 text-lg font-semibold transition-colors ${mode === 'generate' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
          >
            Skapa med AI
          </button>
          <button 
            onClick={() => setMode('parse')}
            className={`flex-1 py-2 text-lg font-semibold transition-colors ${mode === 'parse' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
          >
            Klistra in Pass
          </button>
           <button 
            onClick={() => setMode('manage')}
            className={`flex-1 py-2 text-lg font-semibold transition-colors ${mode === 'manage' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
          >
            Hantera Pass
          </button>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="animate-fade-in">
          {mode === 'create' && (
            <div className="space-y-6 max-w-2xl mx-auto text-center py-10">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Bygg ett eget pass</h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Klicka nedan för att öppna passbyggaren och skapa ett helt nytt, skräddarsytt pass från grunden.
              </p>
              <div className="pt-4">
                <button
                    onClick={onCreateNewWorkout}
                    className="w-full max-w-md mx-auto bg-primary hover:brightness-95 text-white font-bold py-4 px-8 rounded-lg flex items-center justify-center gap-3 transition-colors text-xl shadow-lg"
                >
                    Skapa nytt pass
                </button>
              </div>
            </div>
          )}
          {mode === 'generate' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <p className="text-gray-500 dark:text-gray-400">
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
            </div>
          )}
          
          {mode === 'parse' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <p className="text-gray-500 dark:text-gray-400">
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
            </div>
          )}
          
          {mode === 'manage' && (
             <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold text-left mb-2 text-white">Sparade Pass (Utkast)</h2>
                    <p className="text-gray-400 text-left mb-4 text-sm">
                        Pass som är sparade som utkast. Dessa är inte synliga för andra medlemmar på hemskärmen.
                    </p>
                    {workoutsLoading ? <LoadingList /> : unpublishedWorkouts.length > 0 ? (
                        <div className="space-y-3">
                            {unpublishedWorkouts.map(workout => (
                                <WorkoutListItem key={workout.id} workout={workout} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 bg-white dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">Du har inga sparade utkast eller personliga pass.</p>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-left mb-2 text-white">Publicerade Studiopass</h2>
                    <p className="text-gray-400 text-left mb-4 text-sm">
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
            </div>
          )}
        </div>
        
        {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
      </div>
    </div>
  );
};