import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutLog, UserData, MemberGoals, Page, UserRole } from '../types';
import { listenToMemberLogs, updateUserGoals, updateUserProfile, uploadImage, updateWorkoutLog, deleteWorkoutLog } from '../services/firebaseService';
import { analyzeMemberProgress, MemberProgressAnalysis } from '../services/geminiService';
import { ChartBarIcon, DumbbellIcon, PencilIcon, SparklesIcon, UserIcon, FireIcon, LightningIcon, TrashIcon, CloseIcon, TrophyIcon, InformationCircleIcon } from './icons';
import { Modal } from './ui/Modal';
import { resizeImage } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface MemberProfileScreenProps {
    userData: UserData;
    onBack: () => void;
    profileEditTrigger: number;
    navigateTo: (page: Page) => void;
}

// --- Helper Functions ---

const getLevelInfo = (count: number) => {
    const level = Math.floor(count / 10) + 1;
    const progressToNext = (count % 10) * 10;
    return { level, progressToNext };
};

const getAthleteArchetype = (logs: WorkoutLog[]) => {
    if (logs.length < 3) return { title: "Nykomling", icon: <SparklesIcon className="w-5 h-5" />, color: "from-blue-500 to-cyan-500", desc: "Du är i början av din resa. Fortsätt såhär!" };
    
    let strengthCount = 0;
    let cardioCount = 0;
    let hyroxCount = 0;

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

// --- Sub-components ---

const GoalsEditModal: React.FC<{ currentGoals?: MemberGoals, onSave: (goals: MemberGoals) => void, onClose: () => void }> = ({ currentGoals, onSave, onClose }) => {
    const [selectedGoals, setSelectedGoals] = useState<string[]>(currentGoals?.selectedGoals || []);
    const [targetDate, setTargetDate] = useState(currentGoals?.targetDate || '');
    
    const toggleGoal = (goal: string) => {
        if (selectedGoals.includes(goal)) {
            setSelectedGoals(selectedGoals.filter(g => g !== goal));
        } else {
            setSelectedGoals([...selectedGoals, goal]);
        }
    };

    const handleSave = () => {
        onSave({
            hasSpecificGoals: selectedGoals.length > 0,
            selectedGoals,
            targetDate,
            startDate: currentGoals?.startDate || new Date().toISOString().split('T')[0]
        });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Sätt dina mål" size="sm">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Vad vill du uppnå?</label>
                    <div className="flex flex-wrap gap-2">
                        {['Bli starkare', 'Gå ner i vikt', 'Bättre kondition', 'HYROX', 'Må bra', 'Rörlighet'].map(goal => (
                            <button
                                key={goal}
                                onClick={() => toggleGoal(goal)}
                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${selectedGoals.includes(goal) ? 'bg-primary text-white border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-transparent hover:border-gray-300'}`}
                            >
                                {goal}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Måldatum</label>
                    <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white" />
                </div>
                <button onClick={handleSave} className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:brightness-110">Spara Mål</button>
            </div>
        </Modal>
    );
};

const LogDetailModal: React.FC<{ log: WorkoutLog, onClose: () => void, onUpdate: (id: string, data: Partial<WorkoutLog>) => void, onDelete: (id: string) => void }> = ({ log, onClose, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [comment, setComment] = useState(log.comment || '');
    
    const handleSave = () => {
        onUpdate(log.id, { comment });
        setIsEditing(false);
    };

    const handleDelete = () => {
        if(confirm("Är du säker på att du vill ta bort detta pass?")) {
            onDelete(log.id);
            onClose();
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={log.workoutTitle} size="lg">
            <div className="space-y-6">
                <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{new Date(log.date).toLocaleString()}</span>
                    <span>{log.durationMinutes ? `${log.durationMinutes} min` : ''}</span>
                </div>
                
                {log.exerciseResults && (
                    <div className="space-y-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">Resultat</h4>
                        {log.exerciseResults.map((ex, i) => (
                            <div key={i} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                                <span className="font-medium text-gray-800 dark:text-gray-200">{ex.exerciseName}</span>
                                <span className="font-mono text-primary font-bold">
                                    {ex.weight ? `${ex.weight}kg` : ''} 
                                    {ex.reps ? ` ${ex.reps}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Kommentar</h4>
                    {isEditing ? (
                        <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-3" rows={3} />
                    ) : (
                        <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg italic">{log.comment || "Ingen kommentar."}</p>
                    )}
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    {isEditing ? (
                        <button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-2 rounded-lg">Spara</button>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-lg">Redigera</button>
                    )}
                    <button onClick={handleDelete} className="px-4 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack, profileEditTrigger, navigateTo }) => {
    const isNewUser = !userData.firstName || !userData.organizationId;
    
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(isNewUser);
    const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingGoals, setIsEditingGoals] = useState(false);
    
    // AI State (för Fysik-index)
    const [analysis, setAnalysis] = useState<MemberProgressAnalysis | null>(null);
    const [showInfo, setShowInfo] = useState(false);

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

    // Real-time log listening & AI Analysis
    useEffect(() => {
        if (!userData.uid) return;
        setLoading(true);
        const unsubscribe = listenToMemberLogs(userData.uid, (data) => {
            setLogs(data);
            setLoading(false);

            if (data.length > 0) {
                // Vi hämtar analysen för att få "metrics" till Fysik-indexet
                analyzeMemberProgress(data, userData.firstName || 'Medlem', userData.goals)
                    .then(result => setAnalysis(result))
                    .catch(err => console.error("Analysis error", err));
            }
        });
        return () => unsubscribe();
    }, [userData.uid, userData.firstName, userData.goals]);

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
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const hasWorkoutThisWeek = logs.some(l => new Date(l.date) > oneWeekAgo);
        return { totalWorkouts, thisMonth, isActive: hasWorkoutThisWeek };
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

    if (isEditing) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in pb-24">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Redigera Profil</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Uppdatera dina personuppgifter.</p>
                    </div>
                    {!isNewUser && (
                        <button onClick={() => setIsEditing(false)} className="text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl">Avbryt</button>
                    )}
                </div>

                <div className="space-y-8 bg-white dark:bg-gray-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-primary/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-all relative group shadow-inner"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoUrl ? <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" /> : <UserIcon className="w-16 h-16 text-gray-300" />}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[10px] text-white font-black uppercase tracking-widest">Ändra</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <p className="text-sm font-black text-primary mt-4 uppercase tracking-widest">Din Profilbild</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Förnamn</label>
                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="Förnamn" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Efternamn</label>
                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="Efternamn" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Ålder</label>
                            <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="Ålder" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Kön</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none appearance-none font-bold">
                                <option value="prefer_not_to_say">Vill ej ange</option>
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="other">Annat</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveProfile} 
                        disabled={isSaving || !firstName.trim() || !lastName.trim()}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50 text-lg uppercase tracking-widest"
                    >
                        {isSaving ? 'Sparar...' : 'Spara'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-1 sm:px-6 py-6 animate-fade-in pb-24">
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
            </div>

            <div className="space-y-6">
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

                    <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-3 sm:p-4 shadow-lg shadow-orange-500/20 text-center flex flex-col items-center justify-center min-h-[100px] group">
                        <div className="absolute -left-2 -bottom-2 text-white opacity-20 transform -rotate-12 transition-transform group-hover:scale-110">
                            <FireIcon className="w-16 h-16" />
                        </div>
                        <span className="block text-[10px] font-black text-white/80 uppercase tracking-widest mb-1 relative z-10">Streak</span>
                        <div className="flex items-center justify-center relative z-10 min-h-[36px]">
                             {stats.isActive ? <FireIcon className="w-8 h-8 text-white animate-pulse" /> : <p className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">-</p>}
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

                {/* --- FYSIK-INDEX (Visual Only) --- */}
                {analysis && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">Fysik-index (AI)</h3>
                            <button onClick={() => setShowInfo(!showInfo)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <InformationCircleIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {showInfo && (
                            <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-xs text-gray-500 dark:text-gray-400 leading-relaxed border border-gray-100 dark:border-gray-700 animate-fade-in">
                                <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Hur funkar indexet?</p>
                                <p className="mb-1">AI:n analyserar dina senaste pass för att skapa en profil:</p>
                                <ul className="space-y-1 ml-1">
                                    <li className="flex gap-2"><span className="text-red-500">●</span> <span><strong>Styrka:</strong> Ökar vid tunga lyft och låga repetitioner.</span></li>
                                    <li className="flex gap-2"><span className="text-blue-500">●</span> <span><strong>Kondition:</strong> Ökar vid hög puls och distans.</span></li>
                                    <li className="flex gap-2"><span className="text-green-500">●</span> <span><strong>Frekvens:</strong> Baserat på hur ofta du tränar.</span></li>
                                </ul>
                            </div>
                        )}

                        <div className="space-y-6">
                            {[
                                { label: 'Styrka', val: analysis.metrics.strength, color: 'bg-red-500' },
                                { label: 'Kondition', val: analysis.metrics.endurance, color: 'bg-blue-500' },
                                { label: 'Frekvens', val: analysis.metrics.frequency, color: 'bg-green-500' }
                            ].map(m => (
                                <div key={m.label}>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                                        <span className="text-gray-500">{m.label}</span>
                                        <span className="text-gray-900 dark:text-white">{m.val}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${m.val}%` }} className={`${m.color} h-full rounded-full`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
                {/* ----------------------------------------------------------------- */}

                {/* Goals section */}
                <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-xl">🎯</span> Mina Mål
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => navigateTo(Page.MyStrength)}
                                className="p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                                title="Se min styrka"
                            >
                                <TrophyIcon className="w-5 h-5" />
                            </button>
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
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {userData.goals.selectedGoals.map(g => (
                                    <span key={g} className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide border border-gray-200 dark:border-gray-700">{g}</span>
                                ))}
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

                {/* Latest workouts section */}
                <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-5 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/50">
                        <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Senaste Passen</h3>
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
                                        {log.rpe && <div className="flex flex-col items-center"><span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">RPE</span><span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-black border border-primary/20">{log.rpe}</span></div>}
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:bg-primary group-hover:text-white transition-all"><span className="text-xl">→</span></div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isEditingGoals && <GoalsEditModal currentGoals={userData.goals} onSave={handleSaveGoals} onClose={() => setIsEditingGoals(false)} />}
            {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onUpdate={handleUpdateLog} onDelete={handleDeleteLog} />}
        </div>
    );
};

export default MemberProfileScreen;