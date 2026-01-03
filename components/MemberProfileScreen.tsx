import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutLog, UserData, MemberGoals } from '../types';
import { getMemberLogs, updateUserGoals, updateUserProfile, joinOrganizationWithCode, uploadImage } from '../services/firebaseService';
import { ChartBarIcon, DumbbellIcon, PencilIcon, SparklesIcon, ChevronDownIcon, UserIcon } from './icons';
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
        <Modal isOpen={true} onClose={onClose} title="Sätt dina mål" size="md">
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
                    <span className="font-semibold text-gray-900 dark:text-white">Jag har specifika mål</span>
                    <ToggleSwitch checked={hasSpecificGoals} onChange={setHasSpecificGoals} />
                </div>

                {hasSpecificGoals && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Vad vill du uppnå?</label>
                            <div className="grid grid-cols-2 gap-3">
                                {goalOptions.map(goal => (
                                    <button
                                        key={goal}
                                        onClick={() => toggleGoal(goal)}
                                        className={`p-3 rounded-lg text-sm font-semibold transition-all text-left ${
                                            selectedGoals.includes(goal)
                                            ? 'bg-primary text-white shadow-md transform scale-105'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {selectedGoals.includes(goal) ? '✓ ' : ''}{goal}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">När vill du nå målet?</label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg p-3 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4">
                    <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 rounded-lg">Avbryt</button>
                    <button onClick={handleSave} className="flex-1 bg-primary text-white font-bold py-3 rounded-lg shadow-lg">Spara Mål</button>
                </div>
            </div>
        </Modal>
    );
};

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <div className="relative inline-block w-12 h-6 align-middle select-none transition duration-200 ease-in">
        <input 
            type="checkbox" 
            checked={checked} 
            onChange={(e) => onChange(e.target.checked)} 
            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 ease-in-out transform translate-x-0 checked:translate-x-6 checked:bg-primary checked:border-primary"
        />
        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${checked ? 'bg-primary/30' : 'bg-gray-300'}`}></label>
    </div>
);

const LogDetailModal: React.FC<{ log: WorkoutLog; onClose: () => void }> = ({ log, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose} title={`Detaljer: ${log.workoutTitle}`} size="md">
            <div className="space-y-6">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Datum: {new Date(log.date).toLocaleDateString('sv-SE')}</span>
                    {log.rpe && <span className="font-bold">RPE: {log.rpe}</span>}
                </div>
                
                {log.exerciseResults && log.exerciseResults.length > 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        {log.exerciseResults.map((ex, idx) => (
                            <div key={idx} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                                <span className="font-medium text-gray-900 dark:text-white">{ex.exerciseName}</span>
                                <div className="text-sm">
                                    {ex.weight ? <span className="font-bold text-gray-900 dark:text-white">{ex.weight} kg</span> : <span className="text-gray-400">-</span>}
                                    <span className="text-gray-500 mx-2">|</span>
                                    <span className="text-gray-600 dark:text-gray-300">{ex.reps || '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">Inga specifika övningsresultat loggade.</p>
                )}

                {log.comment && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-sm text-blue-900 dark:text-blue-200">
                        <span className="font-bold block mb-1">Kommentar:</span>
                        {log.comment}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({ userData, onBack }) => {
    const { refreshUserData } = useAuth();
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(!userData.firstName);
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
        if (!isEditing) fetchLogs();
    }, [userData.uid, isEditing]);

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
            if (refreshUserData) await refreshUserData();
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
            // 1. Update basic info
            await updateUserProfile(userData.uid, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                age: age ? parseInt(age) : undefined,
                gender: gender as any,
            });

            // 2. Try to join gym if code is entered
            if (inviteCode.trim() && !userData.organizationId) {
                try {
                    await joinOrganizationWithCode(userData.uid, inviteCode.trim().toUpperCase());
                } catch (e: any) {
                    setInviteError(e.message || 'Kunde inte ansluta till gymmet. Kontrollera koden.');
                    setIsSaving(false);
                    return; // Stop if code fails
                }
            }

            if (refreshUserData) await refreshUserData();
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
            if (refreshUserData) await refreshUserData();
            setIsEditingGoals(false);
        } catch (error) {
            alert("Kunde inte spara målen.");
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

    // --- FORM VIEW ---
    if (isEditing) {
        return (
            <div className="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in pb-24">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Redigera Profil</h1>
                    {userData.firstName && (
                        <button onClick={() => setIsEditing(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl transition-colors">
                            Avbryt
                        </button>
                    )}
                </div>

                <div className="space-y-8 bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center">
                        <div 
                            className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-900 border-4 border-primary/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-all relative group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {photoUrl ? (
                                <img src={photoUrl} alt="Profil" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-16 h-16 text-gray-300" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-xs text-white font-bold uppercase tracking-widest">Ändra</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        <p className="text-sm font-bold text-primary mt-4">Välkommen...</p>
                        <p className="text-xs text-gray-500 mt-1">Låt oss bygga din atletidentitet.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Förnamn</label>
                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Tindra" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Efternamn</label>
                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none" placeholder="Lindström" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ålder</label>
                            <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none" placeholder="28" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kön</label>
                            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none appearance-none">
                                <option value="prefer_not_to_say">Vill ej ange</option>
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="other">Annat</option>
                            </select>
                        </div>
                    </div>

                    {/* Invite Code Section (if not connected) */}
                    {!userData.organizationId && (
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3 text-center">Har du en inbjudningskod?</label>
                            <input 
                                type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} 
                                className="w-full text-center text-3xl font-black font-mono tracking-widest bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none" 
                                placeholder="KOD123" maxLength={6}
                            />
                            {inviteError && <p className="text-red-500 text-xs font-bold text-center mt-2">{inviteError}</p>}
                        </div>
                    )}

                    <button 
                        onClick={handleSaveProfile} 
                        disabled={isSaving || !firstName.trim()}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? 'Sparar...' : 'Spara och fortsätt'}
                    </button>
                </div>
            </div>
        );
    }

    // --- DASHBOARD VIEW ---
    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-8 animate-fade-in pb-24">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-black overflow-hidden border border-primary/20">
                        {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : (userData.firstName?.[0] || userData.email?.[0].toUpperCase())}
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">{userData.firstName} {userData.lastName}</h1>
                        <p className="text-gray-500 dark:text-gray-400">Medlem sedan {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('sv-SE') : 'idag'}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(true)} className="text-sm font-bold text-primary hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors">
                        Redigera Profil
                    </button>
                    <button onClick={onBack} className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl transition-colors">
                        Stäng
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <span className="text-2xl">🎯</span> Mina Mål
                            </h3>
                            {userData.goals?.hasSpecificGoals ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {userData.goals.selectedGoals.map(g => (
                                            <span key={g} className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-medium border border-white/10">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                    {daysLeft !== null && (
                                        <p className="text-blue-100 text-sm font-medium">
                                            {daysLeft} dagar kvar till måldatum ({userData.goals.targetDate})
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-blue-100 italic">Tränar för välmående och hälsa.</p>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsEditingGoals(true)}
                            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors backdrop-blur-md"
                            title="Redigera mål"
                        >
                            <PencilIcon className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.02]">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg"><DumbbellIcon className="w-6 h-6" /></div>
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-xs">Totalt pass</span>
                        </div>
                        <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.totalWorkouts}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-transform hover:scale-[1.02]">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg"><ChartBarIcon className="w-6 h-6" /></div>
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-xs">Denna månad</span>
                        </div>
                        <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.thisMonth}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Senaste Passen</h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <p className="p-6 text-center text-gray-500">Laddar historik...</p>
                        ) : logs.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-400 mb-2">Inga loggade pass än.</p>
                                <p className="text-sm text-gray-500">Kör ett pass och logga det via QR-koden på skärmen!</p>
                            </div>
                        ) : (
                            logs.map(log => (
                                <button 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex justify-between items-center group"
                                >
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{log.workoutTitle}</p>
                                        <p className="text-xs text-gray-500">{new Date(log.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        {log.rpe && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded font-bold">RPE {log.rpe}</span>}
                                        <span className="text-gray-300 dark:text-gray-600">→</span>
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