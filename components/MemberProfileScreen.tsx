
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutLog, UserData, MemberGoals } from '../types';
import { getMemberLogs, updateUserGoals, updateUserProfile, joinOrganizationWithCode, uploadImage } from '../services/firebaseService';
import { ChartBarIcon, DumbbellIcon, PencilIcon, SparklesIcon, ChevronDownIcon, UserIcon, CheckIcon } from './icons';
import { Modal } from './ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { resizeImage } from '../utils/imageUtils';

interface MemberProfileScreenProps {
    userData: UserData;
    onBack: () => void;
}

const GoalsEditModal: React.FC<{
    currentGoals?: MemberGoals;
    onSave: (goals: MemberGoals) => void;
    onClose: () => void;
}> = ({ currentGoals, onSave, onClose }) => {
    const [hasSpecificGoals, setHasSpecificGoals] = useState(currentGoals?.hasSpecificGoals ?? false);
    const [selectedGoals, setSelectedGoals] = useState<string[]>(currentGoals?.selectedGoals || []);
    const [targetDate, setTargetDate] = useState(currentGoals?.targetDate || '');

    const goalOptions = [
        "Bygga muskler", "Gå ner i vikt", "Bli starkare", 
        "Bättre kondition", "Ökad rörlighet", "Må bra / Hälsa",
        "Tävling (t.ex. HYROX)", "Rehab / Skadefri"
    ];

    const toggleGoal = (goal: string) => {
        if (selectedGoals.includes(goal)) {
            setSelectedGoals(prev => prev.filter(g => g !== goal));
        } else {
            setSelectedGoals(prev => [...prev, goal]);
        }
    };

    const handleSave = () => {
        onSave({
            hasSpecificGoals,
            selectedGoals: hasSpecificGoals ? selectedGoals : [],
            targetDate: hasSpecificGoals ? targetDate : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-black mb-6">Sätt dina mål</h2>
                <div className="space-y-6">
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
                        <span className="font-semibold">Jag har specifika mål</span>
                        <ToggleSwitch checked={hasSpecificGoals} onChange={setHasSpecificGoals} />
                    </div>

                    {hasSpecificGoals && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase mb-3">Vad vill du uppnå?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {goalOptions.map(goal => (
                                        <button
                                            key={goal}
                                            onClick={() => toggleGoal(goal)}
                                            className={`p-3 rounded-xl text-xs font-bold transition-all text-left border-2 ${
                                                selectedGoals.includes(goal)
                                                ? 'bg-primary border-primary text-white shadow-md'
                                                : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-transparent hover:bg-gray-100'
                                            }`}
                                        >
                                            {selectedGoals.includes(goal) ? '✓ ' : ''}{goal}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-500 uppercase mb-2">När vill du nå målet?</label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button onClick={onClose} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold py-3 rounded-xl">Avbryt</button>
                        <button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20">Spara Mål</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer select-none">
        <input 
            type="checkbox" 
            checked={checked} 
            onChange={(e) => onChange(e.target.checked)} 
            className="sr-only peer"
        />
        <div className="w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-primary transition-colors"></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
    </label>
);

const LogDetailModal: React.FC<{ log: WorkoutLog; onClose: () => void }> = ({ log, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose} title={`Detaljer: ${log.workoutTitle}`} size="md">
            <div className="space-y-6">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Datum: {new Date(log.date).toLocaleDateString('sv-SE')}</span>
                    {log.rpe && <span className="font-bold text-primary">RPE: {log.rpe}</span>}
                </div>
                
                {log.exerciseResults && log.exerciseResults.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                        {log.exerciseResults.map((ex, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                <span className="font-bold text-gray-900 dark:text-white text-sm">{ex.exerciseName}</span>
                                <div className="text-sm">
                                    {ex.weight ? <span className="font-black text-primary">{ex.weight} kg</span> : <span className="text-gray-400">-</span>}
                                    <span className="text-gray-300 dark:text-gray-600 mx-2">|</span>
                                    <span className="text-gray-600 dark:text-gray-400 font-medium">{ex.reps || '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic text-center py-4">Inga specifika övningsresultat loggade.</p>
                )}

                {log.comment && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-sm text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-800">
                        <span className="font-bold block mb-1 uppercase tracking-wider text-[10px] opacity-70">Kommentar</span>
                        {log.comment}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack }) => {
    const isNewUser = !userData.firstName || !userData.organizationId;
    
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(isNewUser);
    const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditingGoals, setIsEditingGoals] = useState(false);

    // Form states
    const [firstName, setFirstName] = useState(userData.firstName || '');
    const [lastName, setLastName] = useState(userData.lastName || '');
    const [age, setAge] = useState(userData.age?.toString() || '');
    const [gender, setGender] = useState(userData.gender || 'prefer_not_to_say');
    const [photoUrl, setPhotoUrl] = useState(userData.photoUrl || '');
    const [inviteCode, setInviteCode] = useState('');
    const [inviteError, setInviteError] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            if (isEditing || !userData.organizationId || !userData.uid) return;
            
            setLoading(true);
            try {
                const data = await getMemberLogs(userData.uid);
                setLogs(data);
            } catch (error) {
                console.error("Failed to fetch logs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [userData.uid, userData.organizationId, isEditing]);

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
        setInviteError('');
        try {
            await updateUserProfile(userData.uid, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: age ? parseInt(age) : undefined,
                gender: gender as any,
            });

            if (inviteCode.trim() && !userData.organizationId) {
                try {
                    await joinOrganizationWithCode(userData.uid, inviteCode.trim().toUpperCase());
                } catch (e: any) {
                    setInviteError(e.message || 'Kunde inte ansluta till gymmet. Kontrollera koden.');
                    setIsSaving(false);
                    return; 
                }
            }

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

    const toggleTrainingMembership = async (val: boolean) => {
        setIsSaving(true);
        try {
            await updateUserProfile(userData.uid, { isTrainingMember: val });
        } catch (error) {
            alert("Kunde inte uppdatera medlemskap.");
        } finally {
            setIsSaving(false);
        }
    };

    const stats = useMemo(() => {
        const totalWorkouts = logs.length;
        const thisMonth = logs.filter(l => {
            const date = new Date(l.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;
        return { totalWorkouts, thisMonth };
    }, [logs]);

    const daysLeft = useMemo(() => {
        if (!userData.goals?.targetDate) return null;
        const target = new Date(userData.goals.targetDate);
        const now = new Date();
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    }, [userData.goals?.targetDate]);

    // UI för administratörs-medlemskap
    const isStaff = userData.role !== 'member';

    if (isEditing) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in pb-24">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
                            {isNewUser ? 'Välkommen! 👋' : 'Redigera Profil'}
                        </h1>
                        {isNewUser && <p className="text-gray-505 mt-1">Låt oss börja med dina uppgifter.</p>}
                    </div>
                    {!isNewUser && (
                        <button onClick={() => setIsEditing(false)} className="text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl">
                            Avbryt
                        </button>
                    )}
                </div>

                <div className="space-y-8 bg-white dark:bg-gray-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-primary/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-all relative group shadow-inner"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoUrl ? (
                                <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-16 h-16 text-gray-300" />
                            )}
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
                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="Tindra" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Efternamn</label>
                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="Lindström" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider ml-1">Ålder</label>
                            <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary outline-none transition font-bold" placeholder="28" />
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

                    {!userData.organizationId && (
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Har du en inbjudningskod till ett gym?</label>
                            <input 
                                type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} 
                                className="w-full text-center text-4xl font-black font-mono tracking-[0.3em] bg-gray-50 dark:bg-black p-6 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 focus:border-primary focus:ring-0 outline-none text-primary" 
                                placeholder="KOD..." maxLength={6}
                            />
                            {inviteError && <p className="text-red-500 text-xs font-bold text-center mt-3 animate-bounce">{inviteError}</p>}
                        </div>
                    )}

                    <button 
                        onClick={handleSaveProfile} 
                        disabled={isSaving || !firstName.trim() || !lastName.trim()}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50 text-lg uppercase tracking-widest"
                    >
                        {isSaving ? 'Sparar...' : (isNewUser ? 'Bli medlem' : 'Spara ändringar')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-fade-in pb-24">
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-black overflow-hidden border-2 border-primary/20 shadow-inner">
                        {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : (userData.firstName?.[0] || userData.email?.[0].toUpperCase())}
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white leading-none tracking-tight">{userData.firstName} {userData.lastName}</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">Medlem sedan {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('sv-SE') : 'idag'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(true)} className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors">
                        Redigera
                    </button>
                    <button onClick={onBack} className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl transition-colors">
                        Stäng
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                {/* Personal-specifik medlemskaps-widget */}
                {isStaff && (
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-gray-500">
                                <UserIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">Din träningsprofil</h4>
                                <p className="text-xs text-gray-500">Som {userData.role} kan du välja om du vill synas i medlemslistan.</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-2 px-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <span className={`text-xs font-bold uppercase tracking-widest ${userData.isTrainingMember ? 'text-primary' : 'text-gray-400'}`}>
                                {userData.isTrainingMember ? 'Aktiv i listan' : 'Dold i listan'}
                            </span>
                            <ToggleSwitch checked={!!userData.isTrainingMember} onChange={toggleTrainingMembership} />
                        </div>
                    </div>
                )}

                <div className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div className="flex-grow">
                            <h3 className="text-2xl font-black mb-4 flex items-center gap-3">
                                <SparklesIcon className="w-8 h-8 text-yellow-300" /> Mina Mål
                            </h3>
                            {userData.goals?.hasSpecificGoals ? (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {userData.goals.selectedGoals.map(g => (
                                            <span key={g} className="bg-white/20 backdrop-blur-xl px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border border-white/10">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                    {daysLeft !== null && (
                                        <div className="flex items-center gap-2 text-indigo-100">
                                            <div className="h-1.5 flex-grow bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: '45%' }}></div>
                                            </div>
                                            <span className="text-xs font-black whitespace-nowrap uppercase tracking-widest">
                                                {daysLeft} dagar kvar
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-indigo-100/80 font-medium italic">Tränar för välmående och hälsa. Inga specifika mål satta än.</p>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsEditingGoals(true)}
                            className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-all backdrop-blur-xl border border-white/10 ml-4 group"
                            title="Redigera mål"
                        >
                            <PencilIcon className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none"></div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:shadow-xl hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-black text-gray-400 uppercase tracking-[0.2em] text-[10px]">Totalt pass</span>
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl"><DumbbellIcon className="w-5 h-5" /></div>
                        </div>
                        <p className="text-6xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{stats.totalWorkouts}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 transition-all hover:shadow-xl hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-black text-gray-400 uppercase tracking-[0.2em] text-[10px]">Denna månad</span>
                            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl"><ChartBarIcon className="w-5 h-5" /></div>
                        </div>
                        <p className="text-6xl font-black text-gray-900 dark:text-white leading-none tracking-tighter">{stats.thisMonth}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/50">
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
                                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                    <DumbbellIcon className="w-8 h-8" />
                                </div>
                                <p className="text-gray-900 dark:text-white font-black text-lg mb-2">Inga loggade pass än.</p>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto">Kör ett pass och logga det via QR-koden på skärmen för att se din historik här!</p>
                            </div>
                        ) : (
                            logs.map(log => (
                                <button 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className="w-full text-left p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex justify-between items-center group"
                                >
                                    <div className="min-w-0 pr-4">
                                        <p className="font-black text-gray-900 dark:text-white text-lg group-hover:text-primary transition-colors truncate">{log.workoutTitle}</p>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {new Date(log.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </p>
                                    </div>
                                    <div className="flex gap-3 items-center flex-shrink-0">
                                        {log.rpe && (
                                            <div className="flex flex-col items-center">
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">RPE</span>
                                                <span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-black border border-primary/20">{log.rpe}</span>
                                            </div>
                                        )}
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 group-hover:bg-primary group-hover:text-white transition-all">
                                            <span className="text-xl">→</span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {isEditingGoals && (
                <GoalsEditModal 
                    currentGoals={userData.goals} 
                    onSave={handleSaveGoals} 
                    onClose={() => setIsEditingGoals(false)} 
                />
            )}

            {selectedLog && (
                <LogDetailModal 
                    log={selectedLog} 
                    onClose={() => setSelectedLog(null)} 
                />
            )}
        </div>
    );
};

export default MemberProfileScreen;
