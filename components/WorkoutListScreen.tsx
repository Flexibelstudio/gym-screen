
import React, { useMemo, useState, useEffect } from 'react';
import { Workout, WorkoutLog } from '../types';
import { useWorkout } from '../context/WorkoutContext';
import { useStudio } from '../context/StudioContext';
import { SearchIcon, DumbbellIcon, ClockIcon, TrashIcon, TrophyIcon, CloseIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { fetchCustomPrograms, deleteCustomProgram, getMemberLogs } from '../services/firebaseService';
import WorkoutDetailScreen from './WorkoutDetailScreen';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Modal } from './ui/Modal';

interface WorkoutListScreenProps {
    passkategori?: string;
    onSelectWorkout: (workout: Workout, action?: 'view' | 'log') => void;
}

export const WorkoutListScreen: React.FC<WorkoutListScreenProps> = ({ passkategori, onSelectWorkout }) => {
    const { workouts } = useWorkout();
    const { isStudioMode, currentUser } = useAuth();
    const { studioConfig } = useStudio();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'alla' | 'mina'>('alla');
    const [customPrograms, setCustomPrograms] = useState<Workout[]>([]);
    const [programToDelete, setProgramToDelete] = useState<Workout | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Member Logs for PBs
    const [memberLogs, setMemberLogs] = useState<WorkoutLog[]>([]);
    
    // Modal state for history
    const [selectedWorkoutHistory, setSelectedWorkoutHistory] = useState<Workout | null>(null);

    useEffect(() => {
        const load = async () => {
            if (currentUser?.uid) {
                try {
                    const programs = await fetchCustomPrograms(currentUser.uid);
                    setCustomPrograms(programs);
                    const logs = await getMemberLogs(currentUser.uid);
                    setMemberLogs(logs);
                } catch (console) {
                    // Ignore errors fetching
                }
            }
        };
        
        load();
        
        window.addEventListener('customProgramsUpdated', load);
        return () => window.removeEventListener('customProgramsUpdated', load);
    }, [currentUser?.uid, activeTab]);

    const filteredWorkouts = useMemo(() => {
        const sourceWorkouts = (!passkategori && activeTab === 'mina') ? customPrograms : workouts;

        return sourceWorkouts.filter(w => {
            const matchesCategory = !passkategori || w.category === passkategori;
            const matchesSearch = (w.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (w.coachTips && (w.coachTips || '').toLowerCase().includes(searchTerm.toLowerCase()));
            
            // Kolla om kategorin är låst
            const categoryConfig = studioConfig.customCategories.find(c => c.name === w.category);
            const isCategoryLocked = categoryConfig?.isLocked === true;

            // Filtreringslogik baserat på läge (gäller ej egna program)
            if (activeTab !== 'mina') {
                if (isStudioMode) {
                    if (w.showInStudio === false) return false;
                } else {
                    if (w.showInApp === false) return false;
                    if (isCategoryLocked) return false;
                }
            }

            return w.isPublished && matchesCategory && matchesSearch;
        });
    }, [workouts, customPrograms, passkategori, searchTerm, isStudioMode, studioConfig, activeTab]);
    
    const renderWorkoutCard = (workout: Workout, isLoggable: boolean) => {
        if (isStudioMode) {
            return (
                <div
                    key={workout.id}
                    onClick={() => onSelectWorkout(workout, 'view')}
                    className={`cursor-pointer group relative overflow-hidden rounded-[2.5rem] p-8 transition-all bg-white dark:bg-[#0f141e] border-2 border-gray-50 dark:border-gray-800 hover:border-gray-100 dark:hover:border-gray-700 shadow-sm hover:shadow-md flex flex-col min-h-[260px]`}
                    style={{ touchAction: 'manipulation' }}
                >
                    <div className="relative z-10 flex-grow flex flex-col">
                        {workout.benchmarkId && (
                            <div className="mb-4 self-start bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider font-mono">
                                BENCHMARK
                            </div>
                        )}
                        <h3 className="text-2xl font-black text-primary leading-tight mb-4">
                            {workout.title || 'Namnlöst pass'}
                        </h3>
                        {workout.coachTips && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed font-medium">
                                {workout.coachTips}
                            </p>
                        )}
                    </div>
                    <div className="absolute bottom-0 right-0 p-6 opacity-[0.04] dark:opacity-10 transition-opacity pointer-events-none z-0">
                        <DumbbellIcon className="w-24 h-24 text-black dark:text-white" />
                    </div>
                </div>
            );
        }

        const historyLogs = memberLogs.filter(l => l.workoutId === workout.id).sort((a,b) => b.date - a.date);
        const attempts = historyLogs.length;
        const volumeLogs = historyLogs.filter(l => l.totalVolume && l.totalVolume > 0);
        const pbVolume = volumeLogs.length > 0 ? Math.max(...volumeLogs.map(l => l.totalVolume!)) : null;
        
        const latestDate = attempts > 0 ? new Date(historyLogs[0].date).toLocaleDateString('sv-SE') : null;

        return (
            <div
                key={workout.id}
                onClick={() => {
                    setSelectedWorkoutHistory(workout);
                }}
                className={`cursor-pointer group relative overflow-hidden rounded-[2.5rem] p-8 transition-all bg-white dark:bg-[#0f141e] border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-xl flex flex-col`}
                style={{ touchAction: 'manipulation' }}
            >
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                <div className="relative z-10 flex-grow flex flex-col">
                    <div className="flex justify-between items-start mb-6 w-full">
                        <div className="flex items-center gap-2 flex-1 pr-2">
                             <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                                 {workout.title || 'Namnlöst pass'}
                             </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {activeTab === 'mina' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setProgramToDelete(workout);
                                    }}
                                    className="p-2 bg-gray-100 dark:bg-gray-800/80 backdrop-blur-sm text-gray-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors z-40 cursor-pointer border border-gray-200 dark:border-gray-700 hover:scale-105 active:scale-95"
                                    aria-label="Radera pass"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                            {workout.benchmarkId && (
                                <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2.5 py-2.5 rounded-xl border border-yellow-300/30 dark:border-yellow-500/20 shadow-sm">
                                    <TrophyIcon className="w-5 h-5" />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <>
                        {attempts > 0 ? (
                            <div className="flex flex-col justify-end mt-4">
                                {pbVolume && pbVolume > 0 ? (
                                    <p className="text-[2.5rem] leading-none font-black text-gray-900 dark:text-white tracking-tight">
                                        {pbVolume.toLocaleString('sv-SE')} <span className="text-lg text-gray-500 font-bold ml-1">kg</span>
                                    </p>
                                ) : (
                                    <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1">Genomfört</p>
                                )}
                                <p className="text-[11px] text-gray-500 mt-4 uppercase tracking-widest font-black flex items-center gap-2">
                                    {latestDate} • {attempts} FÖRSÖK 
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col justify-end mt-4">
                                 <p className="text-[2.5rem] leading-none font-black text-gray-300 dark:text-gray-700 tracking-tight">
                                     -
                                 </p>
                                 <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-4 uppercase tracking-widest font-black">
                                     INGA FÖRSÖK ÄN
                                 </p>
                            </div>
                        )}

                        <div className="flex gap-2 w-full mt-8 relative z-20">
                             <button
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     onSelectWorkout(workout, 'view');
                                 }}
                                 className="flex-1 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                             >
                                 Visa
                             </button>
                             {isLoggable && (
                                 <button
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         onSelectWorkout(workout, 'log');
                                     }}
                                     className="flex-1 py-3 bg-primary text-white hover:bg-primary/90 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
                                 >
                                     Logga
                                 </button>
                             )}
                        </div>
                    </>
                </div>
                
                <div className="absolute bottom-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none z-0">
                    <DumbbellIcon className="w-20 h-20 text-black dark:text-white" />
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-6 pb-12 animate-fade-in">
            {!passkategori && (
                <div className="text-center mb-6">
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                        Välj Träningspass
                    </h1>
                    <div className="h-1.5 w-24 bg-primary mx-auto rounded-full mb-8"></div>
                    
                    <div className="flex items-center justify-center gap-2 mb-8">
                        <button
                            onClick={() => setActiveTab('alla')}
                            className={`px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-sm transition-all ${
                                activeTab === 'alla'
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Studions Pass
                        </button>
                        <button
                            onClick={() => setActiveTab('mina')}
                            className={`px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-sm transition-all ${
                                activeTab === 'mina'
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            Mina Program ({customPrograms.length})
                        </button>
                    </div>
                </div>
            )}

            {/* Sökfält */}
            <div className="relative max-w-xl mx-auto mb-12">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-6 w-6 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Sök på passets namn..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-12 pr-4 py-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-xl transition-all text-lg"
                />
            </div>

            {filteredWorkouts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {filteredWorkouts.map(workout => {
                        const blocks = workout.blocks || [];
                        const isLoggable = blocks.some(b => 
                            (b.exercises || []).some(e => e.loggingEnabled === true)
                        );
                        
                        return renderWorkoutCard(workout, isLoggable);
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-white dark:bg-gray-900/50 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-gray-800 shadow-inner">
                    <div className="text-6xl mb-4 opacity-20">{searchTerm ? '🔍' : '📭'}</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {searchTerm ? 'Inga pass hittades' : 'Det finns inga pass publicerade i denna kategorin'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Försök att söka på något annat.' : 'Vänligen välj en annan kategori.'}
                    </p>
                </div>
            )}
            
            {programToDelete && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-800">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
                            <TrashIcon className="w-8 h-8 text-red-600 dark:text-red-500" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-2">Radera program?</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
                            Är du säker på att du vill radera <b>{programToDelete.title}</b>? Detta kan inte ångras.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setProgramToDelete(null)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition active:scale-95 disabled:opacity-50"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={async () => {
                                    if (!currentUser?.uid) return;
                                    setIsDeleting(true);
                                    try {
                                        await deleteCustomProgram(currentUser.uid, programToDelete.id);
                                        setProgramToDelete(null);
                                    } catch (e) {
                                        console.error('Failed to delete program', e);
                                    } finally {
                                        setIsDeleting(false);
                                    }
                                }}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-600/20 hover:brightness-110 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {isDeleting ? 'Raderar...' : 'Radera'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VOLUME AND ACTION MODAL --- */}
            {selectedWorkoutHistory && (
                <Modal 
                    isOpen={!!selectedWorkoutHistory} 
                    onClose={() => setSelectedWorkoutHistory(null)}
                    title={selectedWorkoutHistory.title || 'Passhistorik'}
                    size="md"
                >
                    <div className="flex flex-col h-full bg-[#0f141e] text-white">
                        <div className="p-6 overflow-y-auto flex-grow scrollbar-hide">
                            {(() => {
                                const wId = selectedWorkoutHistory.id;
                                const historyLogs = memberLogs.filter(l => l.workoutId === wId).sort((a,b) => a.date - b.date);
                                
                                const chartData = historyLogs
                                    .filter(l => l.totalVolume && l.totalVolume > 0)
                                    .map(l => ({
                                        date: new Date(l.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
                                        volume: l.totalVolume,
                                        rawDate: l.date
                                    }));

                                if (historyLogs.length === 0) {
                                    return (
                                        <div className="text-center py-20 mb-8">
                                            <div className="text-6xl mb-4 opacity-70">🚀</div>
                                            <h3 className="text-xl font-bold text-white mb-2">Ingen historik än</h3>
                                            <p className="text-gray-400">Logga passet idag för att sätta din första standard!</p>
                                        </div>
                                    );
                                }

                                const bestVolume = chartData.length > 0 ? Math.max(...chartData.map(d => d.volume!)) : 0;
                                const timesCompleted = historyLogs.length;

                                return (
                                    <div className="space-y-8">
                                        <div className="flex justify-between items-end border-b border-gray-800 pb-6">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Max Volym</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-black text-green-400">{bestVolume > 0 ? bestVolume.toLocaleString('sv-SE') : '-'}</span>
                                                    <span className="text-sm font-bold text-green-500/70 mb-1">kg</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Försök</p>
                                                <span className="text-3xl font-black text-white">{timesCompleted}</span>
                                            </div>
                                        </div>

                                        {chartData.length > 1 ? (
                                            <div className="h-48 w-full -ml-4 mt-8">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData}>
                                                        <XAxis 
                                                            dataKey="date" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }} 
                                                            dy={10} 
                                                        />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold' }}
                                                            formatter={(value: any) => [`${value} kg`, 'Total Volym']}
                                                        />
                                                        <Line 
                                                            type="monotone" 
                                                            dataKey="volume" 
                                                            stroke="#4ade80" 
                                                            strokeWidth={3} 
                                                            dot={{ r: 4, fill: '#4ade80', strokeWidth: 2, stroke: '#fff' }} 
                                                            activeDot={{ r: 6, fill: '#4ade80', strokeWidth: 0 }}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                             <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-2xl">
                                                 <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Mer data krävs för graf</p>
                                             </div>
                                        )}

                                        <div>
                                            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-4 ml-1">Historik</h3>
                                            <div className="space-y-3">
                                                {[...historyLogs].reverse().map(log => (
                                                    <div key={log.id} className="p-4 bg-gray-800/50 rounded-2xl border border-gray-800 flex justify-between items-center">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-white text-lg">
                                                                    {new Date(log.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                                </span>
                                                                {log.totalVolume === bestVolume && bestVolume > 0 && (
                                                                    <span className="bg-yellow-900/50 text-yellow-500 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ml-2">PB</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
                                                                {log.rpe && <span>RPE {log.rpe}</span>}
                                                                {log.durationMinutes ? <span>{log.durationMinutes} min</span> : null}
                                                            </div>
                                                        </div>
                                                        {log.totalVolume ? (
                                                            <div className="text-right">
                                                                <span className="text-xl font-black text-white">{log.totalVolume.toLocaleString('sv-SE')}</span>
                                                                <span className="text-xs font-bold text-gray-500 ml-1">kg</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-right text-xs font-bold text-gray-600 uppercase tracking-widest">
                                                                Inget uppmätt
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        
                        {/* FOOTER ACTIONS */}
                        <div className="p-4 bg-gray-900 border-t border-gray-800 flex gap-3 flex-shrink-0">
                            <button 
                                onClick={() => {
                                    const w = selectedWorkoutHistory;
                                    setSelectedWorkoutHistory(null);
                                    onSelectWorkout(w, 'view');
                                }}
                                className="flex-1 py-4 px-2 rounded-2xl bg-gray-800 text-white font-black text-xs uppercase tracking-widest border border-gray-700 hover:bg-gray-700 transition active:scale-95 text-center"
                            >
                                Visa Pass
                            </button>
                            <button 
                                onClick={() => {
                                    const w = selectedWorkoutHistory;
                                    setSelectedWorkoutHistory(null);
                                    onSelectWorkout(w, 'log');
                                }}
                                className="flex-[2] py-4 px-2 rounded-2xl bg-green-500 text-gray-900 font-black text-xs uppercase tracking-widest shadow-lg shadow-green-500/20 hover:bg-green-400 transition active:scale-95 text-center"
                            >
                                Logga Pass
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
