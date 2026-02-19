
import React, { useState, useEffect, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import { useWorkout } from '../context/WorkoutContext';
import { updateStudioRemoteState, saveWorkout } from '../services/firebaseService';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise } from '../types';
import { WebQRScanner } from './WebQRScanner';
import { DumbbellIcon, PlayIcon, CloseIcon, ChevronRightIcon, ClockIcon, SparklesIcon, LightningIcon, StarIcon, ChevronLeftIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type RemoteView = 'scan' | 'dashboard' | 'list' | 'timer_setup' | 'controls';

const QuickTimerSetup: React.FC<{ onStart: (settings: TimerSettings, title: string) => void, onBack: () => void }> = ({ onStart, onBack }) => {
    const [mode, setMode] = useState<TimerMode>(TimerMode.Interval);
    
    // Simple state for inputs
    const [minutes, setMinutes] = useState(10);
    const [workSec, setWorkSec] = useState(40);
    const [restSec, setRestSec] = useState(20);
    const [rounds, setRounds] = useState(10); // Totalt antal intervaller eller varv

    const handleStart = () => {
        let settings: TimerSettings = {
            mode,
            workTime: 0,
            restTime: 0,
            rounds: 1,
            prepareTime: 10,
            direction: 'down'
        };

        let title = mode;

        switch (mode) {
            case TimerMode.Interval:
                settings.workTime = workSec;
                settings.restTime = restSec;
                settings.rounds = rounds;
                title = `${rounds} x ${workSec}/${restSec}`;
                break;
            case TimerMode.Tabata:
                settings.mode = TimerMode.Tabata;
                settings.workTime = 20;
                settings.restTime = 10;
                settings.rounds = 8;
                title = "Tabata (Standard)";
                break;
            case TimerMode.AMRAP:
            case TimerMode.TimeCap:
                settings.workTime = minutes * 60;
                settings.restTime = 0;
                settings.rounds = 1;
                title = `${mode} ${minutes} min`;
                break;
            case TimerMode.EMOM:
                settings.workTime = 60;
                settings.restTime = 0;
                settings.rounds = rounds;
                title = `EMOM ${rounds} min`;
                break;
            case TimerMode.Stopwatch:
                 settings.mode = TimerMode.Stopwatch;
                 settings.workTime = 3600;
                 settings.direction = 'up';
                 title = "Stoppur";
                 break;
        }

        onStart(settings, title);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white p-6 animate-fade-in">
             <button onClick={onBack} className="flex items-center gap-2 text-gray-400 font-bold mb-6 hover:text-white">
                <ChevronLeftIcon className="w-5 h-5" /> Tillbaka
            </button>
            
            <h2 className="text-2xl font-black mb-6 text-center">Starta Timer</h2>
            
            <div className="flex flex-wrap gap-2 justify-center mb-8">
                {[TimerMode.Interval, TimerMode.Tabata, TimerMode.AMRAP, TimerMode.EMOM, TimerMode.Stopwatch].map(m => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all ${mode === m ? 'bg-primary border-primary text-white' : 'border-gray-700 text-gray-400'}`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700 mb-8 flex-grow flex flex-col justify-center">
                 {mode === TimerMode.Interval && (
                     <div className="space-y-4">
                         <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arbetstid (sek)</label>
                             <input type="number" value={workSec} onChange={e => setWorkSec(Number(e.target.value))} className="w-full bg-black/50 p-4 rounded-xl text-2xl font-mono font-bold text-center border border-gray-600 focus:border-primary outline-none" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vilotid (sek)</label>
                             <input type="number" value={restSec} onChange={e => setRestSec(Number(e.target.value))} className="w-full bg-black/50 p-4 rounded-xl text-2xl font-mono font-bold text-center border border-gray-600 focus:border-primary outline-none" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Antal Intervaller</label>
                             <input type="number" value={rounds} onChange={e => setRounds(Number(e.target.value))} className="w-full bg-black/50 p-4 rounded-xl text-2xl font-mono font-bold text-center border border-gray-600 focus:border-primary outline-none" />
                         </div>
                     </div>
                 )}
                 {(mode === TimerMode.AMRAP || mode === TimerMode.TimeCap) && (
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total tid (minuter)</label>
                         <input type="number" value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-full bg-black/50 p-6 rounded-xl text-4xl font-mono font-bold text-center border border-gray-600 focus:border-primary outline-none" />
                     </div>
                 )}
                 {mode === TimerMode.EMOM && (
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Antal minuter (ronder)</label>
                         <input type="number" value={rounds} onChange={e => setRounds(Number(e.target.value))} className="w-full bg-black/50 p-6 rounded-xl text-4xl font-mono font-bold text-center border border-gray-600 focus:border-primary outline-none" />
                     </div>
                 )}
                 {mode === TimerMode.Tabata && (
                     <p className="text-center text-gray-400 font-medium">Standard Tabata: 20s jobb, 10s vila, 8 ronder.</p>
                 )}
                 {mode === TimerMode.Stopwatch && (
                     <p className="text-center text-gray-400 font-medium">Klockan räknar uppåt från 0.</p>
                 )}
            </div>

            <button onClick={handleStart} className="w-full bg-primary text-white font-black py-5 rounded-2xl text-lg uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all">
                Starta på TV
            </button>
        </div>
    );
};

export const RemoteControlScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { workouts } = useWorkout();
    const { selectedOrganization, studioConfig } = useStudio();
    
    // State
    const [view, setView] = useState<RemoteView>('scan');
    const [connectedStudioId, setConnectedStudioId] = useState<string | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    
    // Derived
    const connectedStudioName = useMemo(() => {
        if (!selectedOrganization || !connectedStudioId) return '';
        return selectedOrganization.studios.find(s => s.id === connectedStudioId)?.name || 'Okänd skärm';
    }, [selectedOrganization, connectedStudioId]);

    const handleClose = () => {
        if (connectedStudioId) {
            if (window.confirm("Vill du avsluta fjärrkontrollen?")) {
                if (selectedOrganization && connectedStudioId) {
                     updateStudioRemoteState(selectedOrganization.id, connectedStudioId, null);
                }
                onBack();
            }
        } else {
            onBack();
        }
    };

    // Handlers
    const handleScan = (data: string) => {
        try {
            const payload = JSON.parse(data);
            if (payload.sid && payload.action === 'control') {
                setConnectedStudioId(payload.sid);
                setView('dashboard'); // Go to dashboard instead of list
            }
        } catch (e) {
            console.error("Invalid QR");
        }
    };

    const handleSelectWorkout = (workout: Workout) => {
        setSelectedWorkout(workout);
    };

    const handleCastWorkout = async () => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'preview',
            activeBlockId: null,
            lastUpdate: Date.now(),
            controllerName: 'Coach'
        });
        
        setView('controls');
    };

    const handleStartBlock = async (block: WorkoutBlock) => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'timer',
            activeBlockId: block.id,
            lastUpdate: Date.now(),
            controllerName: 'Coach'
        });
    };
    
    const sendCommand = async (cmd: 'start' | 'pause' | 'reset' | 'finish') => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'timer',
            activeBlockId: null, 
            lastUpdate: Date.now(),
            controllerName: 'Coach',
            command: cmd,
            commandTimestamp: Date.now()
        });
    };
    
    const handleStop = async () => {
         if (!selectedOrganization || !connectedStudioId) return;
         await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, null);
         setView('dashboard');
         setSelectedWorkout(null);
    };

    const handleFreestandingStart = async (settings: TimerSettings, title: string) => {
        if (!selectedOrganization || !connectedStudioId) return;

        // Create a temporary workout object for the freestanding timer
        const timerBlock: WorkoutBlock = {
            id: `fs-block-${Date.now()}`,
            title: title,
            tag: 'Fristående',
            setupDescription: 'Fjärrstyrd timer',
            followMe: false,
            settings: settings,
            exercises: [{ id: `ex-${Date.now()}`, name: settings.mode }]
        };

        const tempWorkout: Workout = {
            id: `fs-workout-${Date.now()}`,
            title: title,
            blocks: [timerBlock],
            category: 'Fristående',
            isPublished: false,
            createdAt: Date.now(),
            organizationId: selectedOrganization.id,
            isMemberDraft: true // Ensure it gets cleaned up later
        };

        // 1. Save workout to Firebase so TV can fetch it
        await saveWorkout(tempWorkout);

        // 2. Set remote state
        setSelectedWorkout(tempWorkout);
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: tempWorkout.id,
            view: 'timer',
            activeBlockId: timerBlock.id,
            lastUpdate: Date.now(),
            controllerName: 'Coach'
        });

        setView('controls');
    };

    // --- RENDERERS ---

    if (view === 'scan') {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <WebQRScanner onScan={handleScan} onClose={onBack} />
                <div className="absolute bottom-20 left-0 right-0 text-center pointer-events-none">
                    <p className="text-white font-bold text-lg drop-shadow-md">Scanna QR-koden på TV:n</p>
                </div>
            </div>
        );
    }
    
    if (view === 'timer_setup') {
        return <QuickTimerSetup onStart={handleFreestandingStart} onBack={() => setView('dashboard')} />;
    }

    // DASHBOARD & LIST VIEW (Shared Layout)
    if (view === 'dashboard' || view === 'list') {
        return (
            <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col animate-fade-in">
                {/* Header */}
                <div className="p-5 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-lg z-10">
                    <div>
                        <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Ansluten till
                        </p>
                        <h2 className="text-lg font-black truncate max-w-[200px]">{connectedStudioName}</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"><CloseIcon className="w-5 h-5" /></button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {/* --- DASHBOARD VIEW --- */}
                    {view === 'dashboard' && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Static: Freestanding Timer */}
                            <button 
                                onClick={() => setView('timer_setup')}
                                className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-lg border border-white/10 flex flex-col items-start justify-between h-32 active:scale-95 transition-transform"
                            >
                                <ClockIcon className="w-8 h-8 text-white/80" />
                                <span className="font-bold text-white text-lg leading-tight">Fristående Timer</span>
                            </button>

                            {/* Configured Categories */}
                            {studioConfig.customCategories.map(cat => (
                                <button 
                                    key={cat.id}
                                    onClick={() => { setSelectedCategory(cat.name); setView('list'); }}
                                    className="bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-700 flex flex-col items-start justify-between h-32 active:scale-95 transition-transform hover:bg-gray-750"
                                >
                                    <DumbbellIcon className="w-8 h-8 text-primary" />
                                    <span className="font-bold text-white text-lg leading-tight">{cat.name}</span>
                                </button>
                            ))}
                            
                             {/* Static: HYROX (if enabled) */}
                             {studioConfig.enableHyrox && (
                                <button 
                                    onClick={() => { setSelectedCategory('HYROX'); setView('list'); }}
                                    className="bg-black p-5 rounded-2xl shadow-sm border border-yellow-500/30 flex flex-col items-start justify-between h-32 active:scale-95 transition-transform relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-yellow-500/10 z-0"></div>
                                    <LightningIcon className="w-8 h-8 text-yellow-500 z-10" />
                                    <span className="font-bold text-yellow-500 text-lg leading-tight z-10">HYROX</span>
                                </button>
                            )}

                             {/* Static: Other Workouts */}
                             <button 
                                onClick={() => { setSelectedCategory('other'); setView('list'); }}
                                className="bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-700 flex flex-col items-start justify-between h-32 active:scale-95 transition-transform"
                            >
                                <StarIcon className="w-8 h-8 text-gray-400" />
                                <span className="font-bold text-gray-300 text-lg leading-tight">Övriga Pass</span>
                            </button>
                        </div>
                    )}

                    {/* --- LIST VIEW --- */}
                    {view === 'list' && (
                        <div className="space-y-4">
                            <button onClick={() => { setView('dashboard'); setSelectedWorkout(null); }} className="text-gray-400 text-sm font-bold flex items-center gap-1 mb-2">
                                <ChevronLeftIcon className="w-4 h-4" /> Tillbaka till menyn
                            </button>

                            {selectedWorkout ? (
                                // WORKOUT DETAIL PREVIEW
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-gray-800 p-6 rounded-3xl border border-gray-700">
                                        <span className="text-xs font-bold text-primary uppercase tracking-widest mb-1 block">{selectedWorkout.category}</span>
                                        <h1 className="text-3xl font-black mb-4 leading-tight">{selectedWorkout.title}</h1>
                                        <p className="text-gray-400 text-sm leading-relaxed mb-6">{selectedWorkout.coachTips || "Inga noteringar."}</p>
                                        
                                        <div className="space-y-3">
                                            {selectedWorkout.blocks.map((block, i) => (
                                                <div key={block.id} className="bg-gray-700/50 p-4 rounded-xl flex justify-between items-center border border-gray-600">
                                                    <div>
                                                        <span className="text-[10px] text-gray-400 uppercase font-bold">Block {i+1}</span>
                                                        <p className="font-bold text-white">{block.title}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-gray-300">{block.settings.mode}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-2xl">
                                        <button 
                                            onClick={handleCastWorkout}
                                            className="w-full bg-primary text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="text-2xl">📺</span>
                                            VISA PÅ TV
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // WORKOUT LIST
                                <div className="space-y-3 animate-fade-in">
                                    <h3 className="text-xl font-bold text-white mb-4">{selectedCategory === 'other' ? 'Övriga Pass' : selectedCategory}</h3>
                                    {workouts.filter(w => {
                                        if (!w.isPublished) return false;
                                        if (selectedCategory === 'other') return !w.category || !studioConfig.customCategories.some(c => c.name === w.category);
                                        if (selectedCategory === 'HYROX') return w.id.startsWith('hyrox'); // Simplified check
                                        return w.category === selectedCategory;
                                    }).map(workout => (
                                        <button 
                                            key={workout.id} 
                                            onClick={() => handleSelectWorkout(workout)}
                                            className="w-full text-left bg-gray-800 p-5 rounded-2xl border border-gray-700 active:scale-95 transition-all flex justify-between items-center group"
                                        >
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{workout.title}</h4>
                                                <p className="text-gray-400 text-xs mt-1">{workout.blocks.length} delar</p>
                                            </div>
                                            <ChevronRightIcon className="w-5 h-5 text-gray-500 group-hover:text-white" />
                                        </button>
                                    ))}
                                    {workouts.filter(w => { // Empty state check
                                         if (!w.isPublished) return false;
                                         if (selectedCategory === 'other') return !w.category || !studioConfig.customCategories.some(c => c.name === w.category);
                                         if (selectedCategory === 'HYROX') return w.id.startsWith('hyrox');
                                         return w.category === selectedCategory;
                                    }).length === 0 && (
                                        <p className="text-gray-500 italic text-center py-8">Inga pass hittades i denna kategori.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (view === 'controls') {
        return (
            <div className="fixed inset-0 bg-black text-white z-50 flex flex-col animate-fade-in">
                 {/* Mini Header */}
                 <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live på {connectedStudioName}</span>
                    </div>
                    <button onClick={handleStop} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">Avsluta Session</button>
                </div>

                {/* Now Playing Area */}
                <div className="flex-grow p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-gray-700">
                        <DumbbellIcon className="w-10 h-10 text-gray-500" />
                    </div>
                    <h1 className="text-3xl font-black mb-2 leading-tight">{selectedWorkout?.title}</h1>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto line-clamp-2">{selectedWorkout?.coachTips}</p>
                    
                    {/* Media Controls */}
                    <div className="flex gap-6 mt-10">
                        <button 
                            onClick={() => sendCommand('pause')}
                            className="w-20 h-20 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform border border-gray-700"
                        >
                            <span className="text-3xl">⏸</span>
                        </button>
                        <button 
                            onClick={() => sendCommand('start')}
                            className="w-24 h-24 rounded-full bg-primary hover:bg-teal-400 flex items-center justify-center shadow-xl shadow-primary/20 active:scale-95 transition-transform"
                        >
                            <PlayIcon className="w-12 h-12 text-white ml-1" />
                        </button>
                         <button 
                            onClick={() => sendCommand('finish')}
                            className="w-20 h-20 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform text-red-500 border border-gray-700"
                        >
                            <span className="text-sm font-black uppercase">STOP</span>
                        </button>
                    </div>
                </div>

                {/* Controls - Block List */}
                {selectedWorkout && selectedWorkout.category !== 'Fristående' && (
                    <div className="bg-gray-900 rounded-t-[2.5rem] border-t border-gray-800 flex-grow max-h-[40vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Passets delar</h3>
                            <p className="text-white font-bold text-sm">Klicka play för att hoppa till block</p>
                        </div>
                        
                        <div className="overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
                            {selectedWorkout.blocks.map((block, i) => (
                                <div key={block.id} className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700 flex items-center gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">
                                        {i+1}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h4 className="font-bold text-white truncate">{block.title}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <span className="uppercase">{block.tag}</span>
                                            <span>•</span>
                                            <span>{block.settings.mode}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleStartBlock(block)}
                                        className="w-10 h-10 bg-gray-700 hover:bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all group"
                                    >
                                        <PlayIcon className="w-4 h-4 text-white ml-0.5 group-hover:scale-110 transition-transform" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null;
};
