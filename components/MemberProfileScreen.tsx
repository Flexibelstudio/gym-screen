
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutLog, UserData, MemberGoals, Page, UserRole, SmartGoalDetail, WorkoutDiploma, StudioConfig, BenchmarkDefinition } from '../types';
import { listenToMemberLogs, updateUserGoals, updateUserProfile, uploadImage, updateWorkoutLog, deleteWorkoutLog } from '../services/firebaseService';
import { ChartBarIcon, DumbbellIcon, PencilIcon, SparklesIcon, UserIcon, FireIcon, LightningIcon, TrashIcon, CloseIcon, TrophyIcon, ToggleSwitch, ClockIcon, HistoryIcon } from './icons';
import { Modal } from './ui/Modal';
import { resizeImage } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { MyStrengthScreen } from './MyStrengthScreen';
import { WorkoutDiplomaView } from './WorkoutDiplomaView';
import { useStudio } from '../context/StudioContext';

// --- Local Storage Key ---
const ACTIVE_LOG_STORAGE_KEY = 'smart-skarm-active-log';

interface MemberProfileScreenProps {
    userData: UserData;
    onBack: () => void;
    profileEditTrigger: number;
    navigateTo: (page: Page) => void;
    functions: any;
    studioConfig: StudioConfig;
}

// --- Helper Components ---

const SmartItem: React.FC<{ letter: string, color: string, title: string, text: string }> = ({ letter, color, title, text }) => (
    <div className="flex gap-4 group">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm transition-transform group-hover:scale-110`}>
            {letter}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{title}</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{text || 'Ej angivet.'}</p>
        </div>
    </div>
);

// --- Resume Banner Component (Enhanced Amber UI) ---
const ResumeWorkoutBanner: React.FC<{ 
    workoutTitle: string, 
    onContinue: () => void, 
    onDismiss: () => void 
}> = ({ workoutTitle, onContinue, onDismiss }) => (
    <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-orange-500 rounded-[2rem] p-6 text-orange-950 shadow-xl shadow-orange-500/30 border border-white/40"
    >
        {/* Animated background highlights */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-600/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 bg-orange-950/10 rounded-2xl flex items-center justify-center shadow-inner shrink-0 border border-orange-950/5">
                    <ClockIcon className="w-7 h-7 text-orange-900 animate-pulse" />
                </div>
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-900/60 mb-0.5">Du har ett pågående pass</h4>
                    <p className="text-xl font-black leading-tight truncate max-w-[220px] sm:max-w-md text-orange-950 drop-shadow-sm">{workoutTitle}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                    onClick={onDismiss}
                    className="flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-black bg-orange-950/10 hover:bg-orange-950/20 transition-colors uppercase tracking-widest text-orange-900"
                >
                    Släng
                </button>
                <button 
                    onClick={onContinue}
                    className="flex-[2] sm:flex-none px-8 py-3 rounded-xl text-xs font-black bg-white text-orange-600 shadow-xl hover:scale-105 transition-all uppercase tracking-widest active:scale-95 ring-2 ring-orange-950/5"
                >
                    Fortsätt logga
                </button>
            </div>
        </div>
    </motion.div>
);

// --- Helper Functions ---

const getYearWeek = (date: Date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
};

const calculateWeeklyStreak = (logs: WorkoutLog[]) => {
    if (logs.length === 0) return 0;
    const activeWeeks = new Set(logs.map(log => getYearWeek(new Date(log.date))));
    const now = new Date();
    let streak = 0;
    let checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - 7);
    while (true) {
        const weekKey = getYearWeek(checkDate);
        if (activeWeeks.has(weekKey)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else { break; }
    }
    return streak;
};

const getLevelInfo = (count: number) => {
    const level = Math.floor(count / 10) + 1;
    const progressToNext = (count % 10) * 10;
    return { level, progressToNext };
};

const getAthleteArchetype = (logs: WorkoutLog[]) => {
    if (logs.length < 3) return { title: "Nykomling", icon: <SparklesIcon className="w-5 h-5" />, color: "from-blue-500 to-cyan-500", desc: "Du är i början av din resa. Fortsätt såhär!" };
    let strengthCount = 0, cardioCount = 0, hyroxCount = 0;
    logs.forEach(l => {
        const t = (l.workoutTitle + (l.tags?.join(' ') || '')).toLowerCase();
        if (t.includes('styrka') || t.includes('gym') || t.includes('power')) strengthCount++;
        if (t.includes('kondition') || t.includes('flås') || t.includes('löpning')) cardioCount++;
        if (t.includes('hyrox')) hyroxCount++;
    });
    if (hyroxCount > 3) return { title: "HYROX-Krigare", icon: <LightningIcon className="w-5 h-5" />, color: "from-yellow-500 to-orange-500", desc: "Du älskar funktionell fitness och tävlingsmomentet!" };
    if (strengthCount > cardioCount + 2) return { title: "Lyftaren", icon: <DumbbellIcon className="w-5 h-5" />, color: "from-red-500 to-pink-600", desc: "Tunga lyft är din grej. Starkt jobbat!" };
    if (cardioCount > strengthCount + 2) return { title: "Maskinen", icon: <FireIcon className="w-5 h-5" />, color: "from-orange-400 to-red-500", desc: "Uthållighet av stål. Du slutar aldrig!" };
    return { title: "Hybridatlet", icon: <UserIcon className="w-5 h-5" />, color: "from-indigo-500 to-purple-600", desc: "Du behärskar både styrka och kondition. Den kompletta atleten." };
};

const BenchmarksView: React.FC<{ logs: WorkoutLog[], definitions: BenchmarkDefinition[] }> = ({ logs, definitions }) => {
    
    // Process data to find PBs for each benchmark definition and sort them
    const sortedBenchmarks = useMemo(() => {
        const mapped = definitions.map(def => {
            // Find all logs that match this benchmark ID
            const relevantLogs = logs.filter(l => l.benchmarkId === def.id && l.benchmarkValue !== undefined);
            
            if (relevantLogs.length === 0) return { def, pb: null, attempts: 0 };

            // Sort based on type to find PB
            const sortedLogs = [...relevantLogs].sort((a, b) => {
                if (def.type === 'time') return (a.benchmarkValue || 0) - (b.benchmarkValue || 0); // Lower time is better
                return (b.benchmarkValue || 0) - (a.benchmarkValue || 0); // Higher reps/weight is better
            });

            return {
                def,
                pb: sortedLogs[0],
                attempts: relevantLogs.length
            };
        });

        // Sort: Completed (has PB) first, then unattempted
        return mapped.sort((a, b) => {
            if (a.pb && !b.pb) return -1;
            if (!a.pb && b.pb) return 1;
            return a.def.title.localeCompare(b.def.title); // Fallback alphabetical
        });

    }, [logs, definitions]);

    const formatResult = (val: number, type: string) => {
        if (type === 'time') {
            const m = Math.floor(val / 60);
            const s = val % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        return `${val}`;
    };

    const getUnit = (type: string) => {
        if (type === 'time') return ''; // Usually looks better without 'min' if format is MM:SS
        if (type === 'reps') return 'Varv'; // Changed from 'reps' to 'Varv' as requested
        if (type === 'weight') return 'kg';
        return '';
    };

    if (definitions.length === 0) {
        return (
            <div className="p-12 text-center bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 animate-fade-in">
                <p className="text-gray-400 text-sm">Gymmet har inte lagt upp några benchmarks än.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedBenchmarks.map(({ def, pb, attempts }) => (
                    <div 
                        key={def.id} 
                        className={`relative overflow-hidden rounded-3xl p-6 transition-all ${
                            pb 
                            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border-2 border-yellow-400/30 dark:border-yellow-500/20' 
                            : 'bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary/30'
                        }`}
                    >
                        {pb && <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-3xl -mr-6 -mt-6"></div>}
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className={`font-bold truncate pr-2 text-lg ${pb ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {def.title}
                                </h4>
                                {pb ? (
                                    <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg">
                                        <TrophyIcon className="w-4 h-4" />
                                    </div>
                                ) : (
                                    <div className="bg-gray-100 dark:bg-gray-800 text-gray-400 px-2 py-1 rounded-lg">
                                        <DumbbellIcon className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                            
                            {pb ? (
                                <div>
                                    <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                                        {formatResult(pb.benchmarkValue!, def.type)} <span className="text-sm text-gray-500 font-bold">{getUnit(def.type)}</span>
                                    </p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-wider font-bold">
                                        {new Date(pb.date).toLocaleDateString('sv-SE')} • {attempts} försök
                                    </p>
                                </div>
                            ) : (
                                <div className="py-1">
                                    <p className="text-sm text-gray-400 mb-3">Mätvärde: {def.type === 'time' ? 'Tid' : def.type === 'reps' ? 'Varv/Reps' : 'Vikt'}</p>
                                    <span className="inline-block bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
                                        Gör ett försök!
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Sub-components ---

const GoalsEditModal: React.FC<{ currentGoals?: MemberGoals, onSave: (goals: MemberGoals) => void, onClose: () => void }> = ({ currentGoals, onSave, onClose }) => {
    const [selectedGoals, setSelectedGoals] = useState<string[]>(currentGoals?.selectedGoals || []);
    const [targetDate, setTargetDate] = useState(currentGoals?.targetDate || '');
    const [isSmartEnabled, setIsSmartEnabled] = useState(!!currentGoals?.smartCriteria);
    const [smart, setSmart] = useState<SmartGoalDetail>(currentGoals?.smartCriteria || { specific: '', measurable: '', achievable: '', relevant: '', timeBound: '' });
    const toggleGoal = (goal: string) => setSelectedGoals(selectedGoals.includes(goal) ? selectedGoals.filter(g => g !== goal) : [...selectedGoals, goal]);
    const handleSave = () => onSave({ hasSpecificGoals: selectedGoals.length > 0 || (isSmartEnabled && !!smart.specific), selectedGoals, targetDate, startDate: currentGoals?.startDate || new Date().toISOString().split('T')[0], smartCriteria: isSmartEnabled ? smart : undefined });
    const inputClasses = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all font-medium";
    const labelClasses = "block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1";
    return (
        <Modal isOpen={true} onClose={onClose} title="Sätt dina mål" size="md">
            <div className="space-y-8">
                <div><label className={labelClasses}>Målkategorier</label><div className="flex flex-wrap gap-2">{['Bli starkare', 'Bygga muskler', 'Gå ner i vikt', 'Bättre kondition', 'HYROX', 'Må bra', 'Rörlighet'].map(goal => (<button key={goal} onClick={() => toggleGoal(goal)} className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedGoals.includes(goal) ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-300'}`}>{goal}</button>))}</div></div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50"><ToggleSwitch label="Använd SMART-metoden" checked={isSmartEnabled} onChange={setIsSmartEnabled} /><p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mt-2 ml-1">För dig som vill vara extra tydlig</p></div>
                <AnimatePresence>{isSmartEnabled && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                    <div><label className={labelClasses}>S - Specifikt (Vad exakt?)</label><input value={smart.specific} onChange={e => setSmart({...smart, specific: e.target.value})} className={inputClasses} placeholder="T.ex. Klara 5 chins eller 100kg i knäböj" /></div>
                    <div><label className={labelClasses}>M - Mätbart (Hur vet vi?)</label><input value={smart.measurable} onChange={e => setSmart({...smart, measurable: e.target.value})} className={inputClasses} placeholder="T.ex. Genom antal repetitioner eller kg på stången" /></div>
                    <div><label className={labelClasses}>A - Accepterat (Är det rimligt?)</label><input value={smart.achievable} onChange={e => setSmart({...smart, achievable: e.target.value})} className={inputClasses} placeholder="T.ex. Ja, jag tränar 3 gånger i veckan" /></div>
                    <div><label className={labelClasses}>R - Relevant (Varför är det viktigt?)</label><input value={smart.relevant} onChange={e => setSmart({...smart, relevant: e.target.value})} className={inputClasses} placeholder="T.ex. För att känna mig starkare i vardagen" /></div>
                </motion.div>)}</AnimatePresence>
                <div><label className={labelClasses}>T - Tidsbestämt (Måldatum)</label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={inputClasses} /></div>
                <button onClick={handleSave} className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-widest">Spara Mål</button>
            </div>
        </Modal>
    );
};

const LogDetailModal: React.FC<{ log: WorkoutLog, onClose: () => void, onUpdate: (id: string, data: Partial<WorkoutLog>) => void, onDelete: (id: string) => void }> = ({ log, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [comment, setComment] = useState(log.comment || '');
    const handleSave = () => { onUpdate(log.id, { comment }); setIsEditing(false); };
    const handleDelete = () => { if(confirm("Är du säker på att du vill ta bort detta pass?")) { onDelete(log.id); onClose(); } };
    const isCustomActivity = log.activityType === 'custom_activity' || (!log.exerciseResults || log.exerciseResults.length === 0);
    return (
        <Modal isOpen={true} onClose={onClose} title={log.workoutTitle} size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400"><span>{new Date(log.date).toLocaleString()}</span><div className="flex gap-2">{log.feeling && <span className="font-medium" title="Känsla">{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}{log.rpe && <span className="font-bold bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">RPE {log.rpe}</span>}</div></div>
                {isCustomActivity && (<div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700"><div className="grid grid-cols-3 gap-4 divide-x divide-gray-200 dark:divide-gray-700"><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tid</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.durationMinutes || 0}<span className="text-xs ml-1 font-normal text-gray-500">min</span></p></div><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Distans</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalDistance || 0}<span className="text-xs ml-1 font-normal text-gray-500">km</span></p></div><div className="text-center px-2"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Energi</p><p className="font-mono font-bold text-xl text-gray-900 dark:text-white">{log.totalCalories || 0}<span className="text-xs ml-1 font-normal text-gray-500">kcal</span></p></div></div></div>)}
                {log.exerciseResults && log.exerciseResults.length > 0 && (<div className="space-y-2"><h4 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider mb-2">Resultat</h4>{log.exerciseResults.map((ex, i) => (<div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800"><span className="font-medium text-gray-800 dark:text-gray-200">{ex.exerciseName}</span><span className="font-mono text-primary font-bold">{ex.weight ? `${ex.weight}kg` : ''} {ex.reps ? ` ${ex.reps}` : ''}</span></div>))}</div>)}
                <div><h4 className="font-bold text-gray-900 dark:text-white mb-2 text-sm uppercase tracking-wider">Kommentar</h4>{isEditing ? (<textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition" rows={3} />) : (<p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg italic border border-gray-100 dark:border-gray-800">{log.comment || "Ingen kommentar."}</p>)}</div>
                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">{isEditing ? (<button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:brightness-110 transition-colors">Spara ändringar</button>) : (<button onClick={() => setIsEditing(true)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Redigera text</button>)}<button onClick={handleDelete} className="px-6 text-red-500 font-bold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors flex items-center justify-center border border-red-100 dark:border-red-900/30" title="Radera pass"><TrashIcon className="w-5 h-5" /></button></div>
            </div>
        </Modal>
    );
};

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack, profileEditTrigger, navigateTo, functions, studioConfig }) => {
    const { selectedOrganization } = useStudio();
    const isNewUser = !userData.firstName || !userData.organizationId;
    
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(isNewUser);
    const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    const [isMyStrengthVisible, setIsMyStrengthVisible] = useState(false);
    const [viewingDiploma, setViewingDiploma] = useState<WorkoutDiploma | null>(null);
    
    const [activeTab, setActiveTab] = useState<'overview' | 'benchmarks' | 'history'>('overview');
    
    // Resume session state
    const [activeSession, setActiveSession] = useState<any | null>(null);

    // Form states
    const [firstName, setFirstName] = useState(userData.firstName || '');
    const [lastName, setLastName] = useState(userData.lastName || '');
    const [age, setAge] = useState(userData.age?.toString() || '');
    const [gender, setGender] = useState(userData.gender || 'prefer_not_to_say');
    const [photoUrl, setPhotoUrl] = useState(userData.photoUrl || '');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (profileEditTrigger > 0) setIsEditing(true);
    }, [profileEditTrigger]);

    // Reactive LocalStorage checking
    const checkActiveSession = () => {
        const saved = localStorage.getItem(ACTIVE_LOG_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.memberId === userData.uid) {
                    const title = parsed.workoutTitle || "Namnlöst pass";
                    setActiveSession({ ...parsed, displayTitle: title });
                    return;
                }
            } catch(e) { console.warn(e); }
        }
        setActiveSession(null);
    };

    // 1. Initial check
    useEffect(() => { checkActiveSession(); }, [userData.uid]);

    // 2. Refresh when window gains focus (e.g. after closing the log modal)
    useEffect(() => {
        window.addEventListener('focus', checkActiveSession);
        return () => window.removeEventListener('focus', checkActiveSession);
    }, []);

    // 3. Interval check if a session is currently displayed (to clear it immediately after save)
    useEffect(() => {
        const interval = setInterval(checkActiveSession, 2000);
        return () => clearInterval(interval);
    }, []);

    // Real-time log listening
    useEffect(() => {
        if (!userData.uid) return;
        setLoading(true);
        const unsubscribe = listenToMemberLogs(userData.uid, (data) => {
            setLogs(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [userData.uid]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsSaving(true);
        try {
            const resized = await resizeImage(file, 400, 400, 0.8);
            const path = `users/${userData.uid}/profile_${Date.now()}.jpg`;
            const url = await uploadImage(path, resized);
            setPhotoUrl(url);
            await updateUserProfile(userData.uid, { photoUrl: url });
        } catch (err) {
            alert("Kunde inte spara bilden.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await updateUserProfile(userData.uid, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: age ? parseInt(age) : undefined,
                gender: gender as any,
            });
            setIsEditing(false);
        } catch (error) {
            alert("Kunde inte spara profil.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveGoals = async (newGoals: MemberGoals) => {
        try {
            await updateUserGoals(userData.uid, newGoals);
            setIsEditingGoals(false);
        } catch (error) {
            alert("Kunde inte spara målen.");
        }
    };

    const handleUpdateLog = async (logId: string, updates: Partial<WorkoutLog>) => {
        await updateWorkoutLog(logId, updates);
    };

    const handleDeleteLog = async (logId: string) => {
        await deleteWorkoutLog(logId);
        setSelectedLog(null);
    };

    const stats = useMemo(() => {
        const totalWorkouts = logs.length;
        const now = new Date();
        const thisMonth = logs.filter(l => {
            const date = new Date(l.date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;
        const weeklyStreak = calculateWeeklyStreak(logs);
        const currentWeekKey = getYearWeek(now);
        const hasTrainedThisWeek = logs.some(l => getYearWeek(new Date(l.date)) === currentWeekKey);
        return { totalWorkouts, thisMonth, weeklyStreak, hasTrainedThisWeek };
    }, [logs]);

    const daysLeft = useMemo(() => {
        if (!userData.goals?.targetDate) return null;
        const target = new Date(userData.goals.targetDate);
        const now = new Date();
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }, [userData.goals?.targetDate]);

    const progressPercentage = useMemo(() => {
        if (!userData.goals?.targetDate || !userData.goals?.startDate) return 0;
        const start = new Date(userData.goals.startDate).getTime();
        const target = new Date(userData.goals.targetDate).getTime();
        const now = new Date().getTime();
        if (target <= start) return 100;
        const total = target - start;
        const elapsed = now - start;
        const percent = Math.floor((elapsed / total) * 100);
        return Math.min(100, Math.max(0, percent));
    }, [userData.goals]);

    const archetype = useMemo(() => getAthleteArchetype(logs), [logs]);
    const { level, progressToNext } = useMemo(() => getLevelInfo(logs.length), [logs]);

    const handleResumeWorkout = () => {
        if (activeSession && functions.handleLogWorkoutRequest) {
            const workoutId = activeSession.workoutId === 'manual' ? 'MANUAL_ENTRY' : activeSession.workoutId;
            functions.handleLogWorkoutRequest(workoutId, activeSession.organizationId);
        }
    };

    const handleDismissResume = () => {
        if (confirm("Är du säker på att du vill kasta det sparade passet? All data du fyllt i kommer att försvinna.")) {
            localStorage.removeItem(ACTIVE_LOG_STORAGE_KEY);
            setActiveSession(null);
        }
    };

    // --- RENDER EDIT FORM ---
    if (isEditing) {
        return (
            <div className="w-full max-w-2xl mx-auto px-6 py-12 animate-fade-in pb-32">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Redigera profil</h2>
                    {!isNewUser && (
                        <button onClick={() => setIsEditing(false)} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                            <CloseIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    )}
                </div>

                <div className="space-y-8">
                    {/* Profilbild */}
                    <div className="flex flex-col items-center gap-4">
                        <div 
                            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 shadow-xl flex items-center justify-center overflow-hidden cursor-pointer relative group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-gray-300" />}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-black uppercase tracking-widest">Ändra</span>
                            </div>
                            {isSaving && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Förnamn</label>
                            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Efternamn</label>
                            <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Ålder</label>
                            <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">Kön</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm font-bold appearance-none">
                                <option value="prefer_not_to_say">Vill ej ange</option>
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="other">Annat</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="pt-8">
                        <button 
                            onClick={handleSaveProfile} 
                            disabled={isSaving || !firstName.trim() || !lastName.trim()}
                            className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-tight disabled:opacity-50"
                        >
                            {isSaving ? 'Sparar...' : 'Spara ändringar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-1 sm:px-6 py-6 animate-fade-in pb-24">
            
            {/* 1. Resume Workout Banner */}
            {activeSession && (
                <ResumeWorkoutBanner 
                    workoutTitle={activeSession.displayTitle}
                    onContinue={handleResumeWorkout}
                    onDismiss={handleDismissResume}
                />
            )}

            {/* Header section */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-black overflow-hidden border border-primary/20 shadow-sm">
                        {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" alt="Profil" /> : (userData.firstName?.[0] || userData.email?.[0].toUpperCase())}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{userData.firstName} {userData.lastName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Nivå {level}</span>
                            <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${progressToNext}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setIsMyStrengthVisible(true)}
                    className="flex flex-col items-center gap-1 group transition-all"
                >
                    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm transition-all group-hover:scale-110 group-active:scale-95 group-hover:shadow-md">
                        <TrophyIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-hover:text-primary transition-colors">Styrka</span>
                </button>
            </div>

            {/* --- FLIKAR --- */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-full mb-8">
                {[
                    { id: 'overview', label: 'Översikt', icon: ChartBarIcon },
                    { id: 'benchmarks', label: 'Benchmarks', icon: TrophyIcon },
                    { id: 'history', label: 'Historik', icon: HistoryIcon }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab.id 
                            ? 'bg-white dark:bg-gray-700 text-primary shadow-md' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : 'text-gray-400'}`} />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* --- FLIKINNEHÅLL --- */}

            {activeTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="relative overflow-hidden bg-gray-900 dark:bg-gray-800 rounded-2xl p-3 sm:p-4 shadow-lg border border-gray-800 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -right-2 -top-2 text-gray-800 dark:text-gray-700 opacity-50 transform rotate-12 transition-transform group-hover:scale-110">
                                <DumbbellIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Totalt</span>
                            <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight relative z-10">{stats.totalWorkouts}</p>
                        </div>

                        <div className="relative overflow-hidden bg-gradient-to-br from-primary to-teal-600 rounded-2xl p-3 sm:p-4 shadow-lg shadow-primary/20 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -right-2 -bottom-2 text-white opacity-20 transform -rotate-12 transition-transform group-hover:scale-110">
                                <ChartBarIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-white/80 uppercase tracking-widest mb-1 relative z-10">Månad</span>
                            <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight relative z-10">{stats.thisMonth}</p>
                        </div>

                        <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-500 dark:to-red-500 rounded-2xl p-3 sm:p-4 shadow-lg shadow-orange-500/20 text-center flex flex-col items-center justify-center min-h-[100px] group">
                            <div className="absolute -left-2 -bottom-2 text-orange-200 dark:text-white opacity-20 transform -rotate-12 transition-transform group-hover:scale-110">
                                <FireIcon className="w-16 h-16" />
                            </div>
                            <span className="block text-[10px] font-black text-orange-600 dark:text-white/80 uppercase tracking-widest mb-1 relative z-10">Streak</span>
                            <div className="flex items-center justify-center relative z-10 min-h-[36px] gap-1">
                                <p className="text-3xl sm:text-4xl font-black text-orange-500 dark:text-white leading-none tracking-tight">
                                    {stats.weeklyStreak}
                                </p>
                                <FireIcon className={`w-8 h-8 ${stats.hasTrainedThisWeek ? 'text-orange-500 dark:text-white animate-pulse' : 'text-gray-300 dark:text-gray-600 opacity-50'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Archetype card */}
                    <div className={`bg-gradient-to-br ${archetype.color} rounded-[2rem] p-5 sm:p-8 text-white shadow-2xl relative overflow-hidden`}>
                        <div className="relative z-10">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-1">Din Träningsprofil</p>
                                <h3 className="text-3xl font-black flex items-center gap-3">
                                    {archetype.title}
                                    <span className="bg-white/20 p-1.5 rounded-lg">{archetype.icon}</span>
                                </h3>
                            </div>
                            <p className="text-lg font-medium text-white/90 leading-relaxed max-w-lg mt-4">{archetype.desc}</p>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/20 rounded-full blur-[60px] pointer-events-none"></div>
                    </div>

                    {/* Goals section */}
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-xl">🎯</span> Mina Mål
                            </h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsEditingGoals(true)} 
                                    className="p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                                    title="Redigera mål"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        {userData.goals?.hasSpecificGoals ? (
                            <div className="space-y-6">
                                <div className="flex flex-wrap gap-2">
                                    {userData.goals.selectedGoals.map(g => (
                                        <span key={g} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border border-gray-200 dark:border-gray-700">{g}</span>
                                    ))}
                                </div>

                                <div className="space-y-4 pt-2 border-t border-gray-50 dark:border-gray-800">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Målanalys (SMART)</p>
                                    <div className="space-y-4">
                                        {userData.goals.smartCriteria && (
                                            <>
                                                <SmartItem letter="S" color="bg-blue-500" title="Specifikt" text={userData.goals.smartCriteria.specific} />
                                                <SmartItem letter="M" color="bg-emerald-500" title="Mätbart" text={userData.goals.smartCriteria.measurable} />
                                                <SmartItem letter="A" color="bg-orange-500" title="Accepterat" text={userData.goals.smartCriteria.achievable} />
                                                <SmartItem letter="R" color="bg-rose-500" title="Relevant" text={userData.goals.smartCriteria.relevant} />
                                            </>
                                        )}
                                        <SmartItem letter="T" color="bg-indigo-500" title="Tid" text={userData.goals.targetDate || 'Ingen deadline.'} />
                                    </div>
                                </div>

                                {daysLeft !== null && (
                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                                        <div className="flex-grow">
                                            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1"><span>Framsteg</span><span>{userData.goals.targetDate}</span></div>
                                            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden p-0.5 border border-gray-100 dark:border-gray-800">
                                                <div 
                                                    className="h-full bg-primary rounded-full transition-all duration-1000 relative shadow-[0_0_10px_rgba(20,184,166,0.5)]" 
                                                    style={{ width: `${Math.max(1.5, progressPercentage)}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center min-w-[60px]"><span className="block text-xl font-black text-gray-900 dark:text-white leading-none">{daysLeft}</span><span className="text-[9px] uppercase font-bold text-gray-400">Dagar kvar</span></div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 text-sm italic">Inga specifika mål satta.</p>
                                <button onClick={() => setIsEditingGoals(true)} className="text-primary text-xs font-bold mt-2 hover:underline">Sätt mål nu</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'benchmarks' && (
                selectedOrganization && (
                    <BenchmarksView 
                        logs={logs} 
                        definitions={selectedOrganization.benchmarkDefinitions || []} 
                    />
                )
            )}

            {activeTab === 'history' && (
                <div className="animate-fade-in">
                    {/* Latest workouts section - villkorligt styrt av enableWorkoutLogging */}
                    {studioConfig.enableWorkoutLogging && (
                        <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            <div className="p-5 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/50">
                                <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Loggade Pass</h3>
                                <span className="text-[10px] font-bold text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded uppercase">{logs.length} st</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
                                {loading ? (
                                    <div className="p-12 text-center flex flex-col items-center">
                                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Hämtar historik...</p>
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300"><DumbbellIcon className="w-8 h-8" /></div>
                                        <p className="text-gray-900 dark:text-white font-black text-lg mb-2">Inga loggade pass än.</p>
                                        <p className="text-sm text-gray-500 max-w-xs mx-auto">Kör ett pass och logga det via QR-koden på skärmen för att se din historik här!</p>
                                    </div>
                                ) : (
                                    logs.map(log => (
                                        <button key={log.id} onClick={() => setSelectedLog(log)} className="w-full text-left p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex justify-between items-center group">
                                            <div className="min-w-0 pr-4">
                                                <p className="font-black text-gray-900 dark:text-white text-lg group-hover:text-primary transition-colors truncate">{log.workoutTitle}</p>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(log.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                            </div>
                                            <div className="flex gap-3 items-center flex-shrink-0">
                                                {log.diploma && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setViewingDiploma(log.diploma!);
                                                        }}
                                                        className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors shadow-sm"
                                                        title="Visa Diplom"
                                                    >
                                                        <TrophyIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {log.rpe && <div className="flex flex-col items-center"><span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">RPE</span><span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-black border border-primary/20">{log.rpe}</span></div>}
                                                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:bg-primary group-hover:text-white transition-all"><span className="text-xl">→</span></div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isEditingGoals && <GoalsEditModal currentGoals={userData.goals} onSave={handleSaveGoals} onClose={() => setIsEditingGoals(false)} />}
            {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />}
            
            <AnimatePresence>
                {isMyStrengthVisible && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
                            onClick={() => setIsMyStrengthVisible(false)}
                        />
                        <motion.div 
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: '0%', opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 top-[5vh] bottom-[5vh] z-[2010] px-1 pointer-events-none"
                        >
                            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] h-full max-w-2xl mx-auto shadow-2xl overflow-hidden flex flex-col pointer-events-auto relative">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center flex-shrink-0">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        Min Styrka <span className="text-2xl">🏆</span>
                                    </h2>
                                    <button onClick={() => setIsMyStrengthVisible(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                        <CloseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                                    </button>
                                </div>
                                
                                <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                                    <MyStrengthScreen onBack={() => setIsMyStrengthVisible(false)} />
                                </div>

                                <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900">
                                    <button 
                                        onClick={() => setIsMyStrengthVisible(false)}
                                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-black py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                                    >
                                        STÄNG
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {viewingDiploma && (
                    <WorkoutDiplomaView 
                        diploma={viewingDiploma} 
                        onClose={() => setViewingDiploma(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default MemberProfileScreen;
