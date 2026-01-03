import React, { useState, useEffect, useRef } from 'react';
import { getMemberLogs, getWorkoutsForOrganization, saveWorkoutLog } from '../../services/firebaseService';
import { generateMemberInsights, MemberInsightResponse } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext'; 
import { CloseIcon, DumbbellIcon, SparklesIcon, FireIcon, RunningIcon, ChevronDownIcon } from '../../components/icons'; 
import { Confetti } from '../../components/WorkoutCompleteModal'; 

// --- Types ---

type MemberFeeling = 'top' | 'good' | 'ok' | 'heavy' | 'injured';
type RepRange = '1-5' | '6-10' | '11-15' | '16+';

interface ExerciseResult {
  exerciseId: string;
  exerciseName: string;
  weight?: string;
  reps: RepRange | null;
  distance?: string;
  kcal?: string;
}

interface LogData {
  rpe: number | null;
  feeling: MemberFeeling | null;
  comment: string;
}

interface WorkoutData {
  id: string;
  title: string;
  blocks: {
      exercises: { id: string; name: string }[]
  }[];
}

// --- Helper Functions ---

const normalizeString = (str: string) => {
    return str.toLowerCase().trim().replace(/[^\w\såäöÅÄÖ]/g, ''); // Behåll bokstäver, ta bort emojis/specialtecken
};

const isExerciseMatch = (
    targetName: string, 
    targetId: string, 
    candidateName: string, 
    candidateId: string | undefined
): boolean => {
    // 1. ID Match (Guldstandard)
    if (targetId && candidateId && targetId === candidateId) {
        return true;
    }

    const nTarget = normalizeString(targetName);
    const nCandidate = normalizeString(candidateName);

    // 2. Exakt matchning på tvättat namn
    if (nTarget === nCandidate) {
        return true;
    }

    // 3. Fuzzy / Innehåller (Historik innehåller pass-namnet)
    if (nCandidate.includes(nTarget) && nTarget.length > 3) {
        return true;
    }

    return false;
};

const detectDefaultMode = (name: string): 'cardio' | 'strength' => {
    const cardioKeywords = ['run', 'spring', 'löp', 'jogg', 'roddmaskin', 'rowing', 'ski', 'stak', 'cykel', 'bike', 'assault', 'crosstrainer', 'elliptical', 'löpning'];
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('stående rodd') || lowerName.includes('skivstångsrodd') || lowerName.includes('hantelrodd')) {
        return 'strength';
    }

    if (cardioKeywords.some(keyword => lowerName.includes(keyword))) {
        return 'cardio';
    }
    
    if (lowerName === 'rodd' || lowerName.includes(' rodd ')) {
        return 'cardio';
    }

    return 'strength';
};

// --- Components ---

const ExerciseLogCard: React.FC<{
  name: string;
  result: ExerciseResult;
  onUpdate: (updates: Partial<ExerciseResult>) => void;
  lastWeight?: number;
  aiSuggestion?: string;
}> = ({ name, result, onUpdate, lastWeight, aiSuggestion }) => {
  const repOptions: RepRange[] = ['1-5', '6-10', '11-15', '16+'];
  
  // Local state to control the input mode manually
  const [mode, setMode] = useState<'strength' | 'cardio'>(detectDefaultMode(name));

  const isCardio = mode === 'cardio';

  const toggleMode = () => {
      setMode(prev => prev === 'cardio' ? 'strength' : 'cardio');
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border mb-4 transition-colors ${isCardio ? 'border-orange-100 dark:border-orange-900/30' : 'border-gray-100 dark:border-gray-700'}`}>
      <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${isCardio ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'}`}>
                {isCardio ? <RunningIcon className="w-5 h-5" /> : <DumbbellIcon className="w-5 h-5" />}
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight max-w-[180px] sm:max-w-xs">{name}</h3>
          </div>
          
          <button 
            onClick={toggleMode}
            className="text-xs font-semibold text-gray-400 hover:text-primary dark:hover:text-white bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded border border-gray-100 dark:border-gray-600 transition-colors whitespace-nowrap"
          >
            {isCardio ? 'Byt till Styrka' : 'Byt till Cardio'}
          </button>
      </div>

      {isCardio ? (
        // --- Cardio Inputs ---
        <div className="flex gap-4 animate-fade-in">
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Distans (m)</label>
                <input
                  type="number"
                  placeholder="t.ex. 1000"
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500 focus:outline-none transition font-semibold text-lg"
                  value={result.distance || ''}
                  onChange={(e) => onUpdate({ distance: e.target.value })}
                />
            </div>
            <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FireIcon className="w-3 h-3 text-orange-500" /> Kcal
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500 focus:outline-none transition font-semibold text-lg"
                  value={result.kcal || ''}
                  onChange={(e) => onUpdate({ kcal: e.target.value })}
                />
            </div>
        </div>
      ) : (
        // --- Strength Inputs ---
        <div className="animate-fade-in">
            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Repetitioner</label>
                <div className="flex gap-2">
                {repOptions.map((option) => {
                    const isActive = result.reps === option;
                    return (
                    <button
                        key={option}
                        onClick={() => onUpdate({ reps: option })}
                        className={`flex-1 py-3 px-1 rounded-lg text-xs font-bold transition-colors border ${
                            isActive 
                            ? 'bg-teal-500 text-white border-teal-500' 
                            : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                    >
                        {option}
                    </button>
                    );
                })}
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vikt (kg)</label>
                <input
                type="number"
                placeholder={lastWeight ? `${lastWeight}` : "0"}
                className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-teal-500 focus:outline-none transition font-semibold text-lg"
                value={result.weight}
                onChange={(e) => onUpdate({ weight: e.target.value })}
                />
                
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                    {aiSuggestion && (
                    <button 
                        onClick={() => onUpdate({ weight: aiSuggestion.replace('kg', '').trim() })} 
                        className="flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                    >
                        <SparklesIcon className="w-3 h-3" />
                        Smart Load: {aiSuggestion}
                    </button>
                    )}
                    {lastWeight !== undefined && lastWeight > 0 && !aiSuggestion && (
                    <button 
                        onClick={() => onUpdate({ weight: lastWeight.toString() })}
                        className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                    >
                        PB: {lastWeight} kg
                    </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const PostWorkoutForm: React.FC<{
  data: LogData;
  onUpdate: (updates: Partial<LogData>) => void;
}> = ({ data, onUpdate }) => {
  const feelings: { key: MemberFeeling; label: string; icon: string }[] = [
    { key: 'top', label: 'Topp', icon: '🤩' },
    { key: 'good', label: 'Bra', icon: '🙂' },
    { key: 'ok', label: 'OK', icon: '😐' },
    { key: 'heavy', label: 'Tung', icon: '🥵' },
    { key: 'injured', label: 'Ont', icon: '🤕' },
  ];

  return (
    <div className="mt-6 mb-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Hur kändes passet?</h3>

      {/* RPE Selector */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Ansträngning (RPE 1-10)</label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
            const isActive = data.rpe === num;
            return (
              <button
                key={num}
                onClick={() => onUpdate({ rpe: num })}
                className={`w-10 h-10 flex-shrink-0 rounded-full font-bold transition-all flex items-center justify-center border ${
                    isActive 
                    ? 'bg-teal-500 text-white border-teal-500 scale-110 shadow-md' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-teal-500'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mt-1 px-1">
            <span>Lätt</span>
            <span>Maximalt</span>
        </div>
      </div>

      {/* Feeling Selector */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Känsla</label>
        <div className="grid grid-cols-5 gap-2">
          {feelings.map((item) => {
            const isActive = data.feeling === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onUpdate({ feeling: item.key })}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${
                    isActive 
                    ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-500 shadow-sm' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className={`text-[10px] font-bold ${isActive ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment Input */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kommentar (valfritt)</label>
        <textarea
          placeholder="Anteckningar om passet..."
          value={data.comment}
          onChange={(e) => onUpdate({ comment: e.target.value })}
          className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none h-24"
        />
      </div>
    </div>
  );
};

// --- Main Screen ---

interface WorkoutLogScreenProps {
    workoutId?: string;
    organizationId?: string;
    onClose?: () => void;
    navigation?: any;
    route?: any;
}

export default function WorkoutLogScreen({ 
    workoutId, 
    organizationId, 
    onClose, 
    navigation, 
    route 
}: WorkoutLogScreenProps) {
  
  const wId = workoutId || route?.params?.workoutId;
  const oId = organizationId || route?.params?.organizationId;
  
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || "offline_member_uid"; 

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<WorkoutData | null>(null);
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [logData, setLogData] = useState<LogData>({ rpe: null, feeling: null, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  
  const [history, setHistory] = useState<Record<string, number>>({}); 
  const [aiInsights, setAiInsights] = useState<MemberInsightResponse | null>(null);
  
  useEffect(() => {
    if (!wId || !oId) {
        setLoading(false);
        return;
    }

    const init = async () => {
        try {
            const orgWorkouts = await getWorkoutsForOrganization(oId);
            const foundWorkout = orgWorkouts.find(w => w.id === wId);
            
            if (foundWorkout) {
                setWorkout(foundWorkout as unknown as WorkoutData);
                
                const exercises = foundWorkout.blocks.flatMap(b => b.exercises);
                const initialResults = exercises.map(ex => ({
                    exerciseId: ex.id,
                    exerciseName: ex.name,
                    weight: '',
                    reps: null,
                    distance: '',
                    kcal: ''
                }));
                setExerciseResults(initialResults);

                setLoading(false);
                const logs = await getMemberLogs(userId);
                
                const historyMap: Record<string, number> = {};
                
                exercises.forEach(currentEx => {
                    let maxWeight = 0;
                    
                    logs.forEach(log => {
                        log.exerciseResults?.forEach(logEx => {
                            if (logEx.weight && isExerciseMatch(currentEx.name, currentEx.id, logEx.exerciseName, logEx.exerciseId)) {
                                if (logEx.weight > maxWeight) {
                                    maxWeight = logEx.weight;
                                }
                            }
                        });
                    });

                    if (maxWeight > 0) {
                        historyMap[currentEx.name] = maxWeight;
                    }
                });
                
                setHistory(historyMap);

                const exerciseNames = exercises.map(e => e.name);
                generateMemberInsights(logs, foundWorkout.title, exerciseNames)
                    .then(setAiInsights)
                    .catch(err => console.log("AI Insight Error", err));

            } else {
                setLoading(false); 
            }
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };
    
    init();
  }, [wId, oId, userId]);

  const handleUpdateResult = (index: number, updates: Partial<ExerciseResult>) => {
    const newResults = [...exerciseResults];
    newResults[index] = { ...newResults[index], ...updates };
    setExerciseResults(newResults);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // FIX: Se till att vi aldrig skickar 'undefined' till Firebase
    const payload = {
      memberId: userId,
      organizationId: oId,
      workoutId: wId,
      workoutTitle: workout?.title || 'Unknown',
      source: 'qr_scan' as const,
      // Använd null istället för undefined för optional-fält
      rpe: logData.rpe ?? null, 
      feeling: logData.feeling ?? null,
      comment: logData.comment || "", // Tom sträng om kommentar saknas
      
      exerciseResults: exerciseResults.map(r => ({
        exerciseId: r.exerciseId,
        blockId: 'unknown',
        exerciseName: r.exerciseName,
        reps: r.reps ?? null,
        // Säkra nummer-konvertering
        weight: r.weight ? parseFloat(r.weight) : null,
        distance: r.distance ? parseFloat(r.distance) : null,
        kcal: r.kcal ? parseFloat(r.kcal) : null
      })),
      date: Date.now()
    };

    try {
        await saveWorkoutLog(payload);
        
        setShowCelebration(true);
        
        setTimeout(() => {
          setIsSubmitting(false);
          setShowCelebration(false);
          
          if (onClose) {
              onClose();
          } else if (navigation) {
              const feedbackText = aiInsights?.readiness?.message || "Bra jobbat!";
              navigation.replace('WorkoutFeedback', { feedbackText });
          }
        }, 2500); 
    } catch (e: any) {
        // --- DETALJERAD FELHANTERING ---
        console.error("🔥 KRITISKT FEL VID SPARA PASS 🔥");
        console.error("Felobjekt:", e);
        if (e.code) console.error("Felkod:", e.code);
        if (e.message) console.error("Felmeddelande:", e.message);
        
        setIsSubmitting(false);
        alert(`Kunde inte spara. Teknisk orsak: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Hämtar pass...</p>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-500 font-bold mb-4">Kunde inte hitta passet.</p>
        <button onClick={onClose} className="text-gray-600 underline">Gå tillbaka</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col relative overflow-hidden">
      {showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
              <Confetti />
              <div className="bg-white p-8 rounded-3xl text-center shadow-2xl max-w-sm mx-4 relative z-10 transform scale-110">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2">Snyggt jobbat!</h2>
                  <p className="text-gray-600">Ditt pass är registrerat.</p>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 p-4 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white leading-none">{workout.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Logga dina resultat</p>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                <CloseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {/* AI Banner */}
          {aiInsights && aiInsights.readiness && (
              <div className={`p-4 rounded-xl mb-6 shadow-sm flex items-start gap-4 ${
                  aiInsights.readiness.status === 'low' ? 'bg-orange-100 text-orange-900' : 
                  aiInsights.readiness.status === 'high' ? 'bg-green-100 text-green-900' : 
                  'bg-blue-100 text-blue-900'
              }`}>
                  <div className="p-2 bg-white/50 rounded-lg">
                      <SparklesIcon className="w-5 h-5" />
                  </div>
                  <div>
                      <h4 className="font-bold text-sm uppercase tracking-wide opacity-80 mb-1">AI Coach Analys</h4>
                      <p className="font-medium text-sm leading-relaxed">{aiInsights.readiness.message}</p>
                  </div>
              </div>
          )}

          {exerciseResults.map((result, index) => (
            <ExerciseLogCard
              key={result.exerciseId}
              name={result.exerciseName}
              result={result}
              onUpdate={(updates) => handleUpdateResult(index, updates)}
              aiSuggestion={aiInsights?.suggestions?.[result.exerciseName]}
              lastWeight={history[result.exerciseName]}
            />
          ))}

          <PostWorkoutForm 
            data={logData} 
            onUpdate={u => setLogData(prev => ({ ...prev, ...u }))} 
          />
          
          <div className="h-20"></div> {/* Spacer for FAB */}
      </div>

      {/* Footer FAB */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-500/30 transition-all transform active:scale-95 disabled:bg-gray-400 disabled:shadow-none disabled:transform-none"
            >
                {isSubmitting ? 'Sparar...' : 'Spara Pass'}
            </button>
          </div>
      </div>
    </div>
  );
}