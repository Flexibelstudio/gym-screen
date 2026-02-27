
import React, { useState, useEffect, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import { useWorkout } from '../context/WorkoutContext';
import { useAuth } from '../context/AuthContext';
import { updateStudioRemoteState, saveWorkout } from '../services/firebaseService';
import { Workout, WorkoutBlock, TimerMode, TimerSettings, Exercise, TimerStatus } from '../types';
import { WebQRScanner } from './WebQRScanner';
import { DumbbellIcon, PlayIcon, CloseIcon, ChevronRightIcon, ClockIcon, SparklesIcon, LightningIcon, StarIcon, ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon, RefreshIcon, SettingsIcon, PencilIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleWorkoutBuilderScreen } from './SimpleWorkoutBuilderScreen';

// --- Types ---
type RemoteView = 'select_studio' | 'scan' | 'dashboard' | 'list' | 'timer_setup' | 'controls' | 'edit';

// Helper component for uniform buttons
const DashboardButton: React.FC<{ 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string; 
}> = ({ onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`
            p-5 rounded-2xl shadow-lg flex flex-col items-start justify-between h-32 active:scale-95 transition-transform border border-white/10 relative overflow-hidden
            bg-gradient-to-br from-primary to-teal-700 text-white
        `}
    >
        <div className="relative z-10 text-white">
             {icon}
        </div>
        <span className="relative z-10 font-bold text-lg leading-tight text-white">
            {label}
        </span>
    </button>
);

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
                Ladda på skärm
            </button>
        </div>
    );
};

export const RemoteControlScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { workouts } = useWorkout();
    const { selectedOrganization, studioConfig } = useStudio();
    const { userData, currentUser } = useAuth();
    
    // State
    const [view, setView] = useState<RemoteView>('select_studio');
    const [connectedStudioId, setConnectedStudioId] = useState<string | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [activeRunningBlockId, setActiveRunningBlockId] = useState<string | null>(null);
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    
    // Optimistic state for commands
    const [isSendingCommand, setIsSendingCommand] = useState<string | null>(null);
    
    // Derived
    const connectedStudioName = useMemo(() => {
        if (!selectedOrganization || !connectedStudioId) return '';
        return selectedOrganization.studios.find(s => s.id === connectedStudioId)?.name || 'Okänd skärm';
    }, [selectedOrganization, connectedStudioId]);

    const currentControllerName = useMemo(() => {
        if (userData?.firstName) return `${userData.firstName} ${userData.lastName || ''}`.trim();
        if (currentUser?.email) return currentUser.email.split('@')[0];
        return 'Coach';
    }, [userData, currentUser]);

    const handleClose = async () => {
        if (connectedStudioId) {
            if (window.confirm("Vill du koppla från fjärrkontrollen?")) {
                if (selectedOrganization && connectedStudioId) {
                    // Clear controller name when disconnecting
                    await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
                        controllerName: undefined // This should remove the field or set it to undefined
                    } as any);
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
            controllerName: currentControllerName
        });
        
        setView('controls');
    };

    // LOAD Block (Does not start timer)
    const handleLoadBlock = async (block: WorkoutBlock) => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        setActiveRunningBlockId(block.id);
        setExpandedBlockId(block.id); // Auto expand
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'timer',
            activeBlockId: block.id,
            lastUpdate: Date.now(),
            controllerName: currentControllerName,
            // NO START COMMAND HERE - Just load it
        });
    };

    const handleCloseBlock = async () => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        setActiveRunningBlockId(null);
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'preview', // Go back to workout detail
            activeBlockId: null,
            lastUpdate: Date.now(),
            controllerName: currentControllerName
        });
    };
    
    const sendCommand = async (cmd: 'start' | 'pause' | 'resume' | 'reset' | 'finish') => {
        if (!selectedOrganization || !connectedStudioId || !selectedWorkout) return;
        
        // Optimistic feedback
        setIsSendingCommand(cmd);
        setTimeout(() => setIsSendingCommand(null), 1000);

        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'timer',
            activeBlockId: activeRunningBlockId, // Keep current block
            lastUpdate: Date.now(),
            controllerName: currentControllerName,
            command: cmd,
            commandTimestamp: Date.now()
        });
    };
    
    const handleExitSession = async () => {
         if (!selectedOrganization || !connectedStudioId) return;
         if (window.confirm("Vill du avsluta hela sessionen och gå till hemskärmen?")) {
             await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, null);
             setView('dashboard');
             setSelectedWorkout(null);
             setActiveRunningBlockId(null);
         }
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

        // 2. Set remote state - LOAD ONLY first
        setSelectedWorkout(tempWorkout);
        setActiveRunningBlockId(timerBlock.id);
        setExpandedBlockId(timerBlock.id);
        
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: tempWorkout.id,
            view: 'timer',
            activeBlockId: timerBlock.id,
            lastUpdate: Date.now(),
            controllerName: currentControllerName
        });

        setView('controls');
    };

    const [showViewSettings, setShowViewSettings] = useState(false);

    // --- VIEW SETTINGS HANDLER ---
    // Use a ref to store the latest values to debounce updates
    const pendingSettingsRef = React.useRef<{ textScale?: number, repsScale?: number } | null>(null);
    const updateTimeoutRef = React.useRef<number | null>(null);
    
    // Local state for immediate UI feedback
    const [localRepsScale, setLocalRepsScale] = useState<number | null>(null);
    const [localTextScale, setLocalTextScale] = useState<number | null>(null);

    // --- SYNC WITH STUDIO STATE ---
    // If the studio we are controlling exits the workout/timer, we should also exit the controls view
    useEffect(() => {
        if (!selectedOrganization || !connectedStudioId || view !== 'controls') return;
        
        const studio = selectedOrganization.studios.find(s => s.id === connectedStudioId);
        const remoteState = studio?.remoteState;
        
        // IMPORTANT: Only exit if the view explicitly changes to idle/menu OR if activeWorkoutId is explicitly cleared
        // We add a small delay check to avoid jumping due to transient state updates
        if (remoteState && (remoteState.view === 'idle' || remoteState.view === 'menu' || remoteState.activeWorkoutId === null)) {
            // Guard: If we just updated settings, wait a bit before allowing an exit based on remote state
            // to ensure we are seeing the latest merged state
            const wasFreestanding = selectedWorkout?.id.startsWith('fs-workout-') || selectedWorkout?.id.startsWith('freestanding-workout-');
            
            if (wasFreestanding) {
                setView('timer_setup');
            } else {
                setView('dashboard');
            }
            setSelectedWorkout(null);
            setActiveRunningBlockId(null);
        }
    }, [selectedOrganization, connectedStudioId, view, selectedWorkout]);

    // Sync local state with remote state when not dragging
    useEffect(() => {
        if (!selectedOrganization || !connectedStudioId) return;
        const studio = selectedOrganization.studios.find(s => s.id === connectedStudioId);
        const remoteSettings = studio?.remoteState?.viewerSettings;
        
        if (remoteSettings) {
            if (pendingSettingsRef.current?.textScale === undefined) setLocalTextScale(remoteSettings.textScale);
            if (pendingSettingsRef.current?.repsScale === undefined) setLocalRepsScale(remoteSettings.repsScale);
        }
    }, [selectedOrganization, connectedStudioId]);

    const handleUpdateViewSettings = (setting: 'text' | 'reps', value: number) => {
        if (!selectedOrganization || !connectedStudioId) return;

        // 1. Update local state immediately for smooth slider
        if (setting === 'text') setLocalTextScale(value);
        else setLocalRepsScale(value);

        // 2. Store in pending ref
        if (!pendingSettingsRef.current) pendingSettingsRef.current = {};
        if (setting === 'text') pendingSettingsRef.current.textScale = value;
        else pendingSettingsRef.current.repsScale = value;

        // 3. Debounce the Firebase update
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        
        updateTimeoutRef.current = window.setTimeout(async () => {
            const studio = selectedOrganization.studios.find(s => s.id === connectedStudioId);
            const currentSettings = studio?.remoteState?.viewerSettings || { textScale: 1, repsScale: 1 };
            
            const newViewerSettings = {
                textScale: pendingSettingsRef.current?.textScale ?? currentSettings.textScale ?? 1,
                repsScale: pendingSettingsRef.current?.repsScale ?? currentSettings.repsScale ?? 1,
            };

            // Clear pending ref BEFORE await to allow new updates to queue
            pendingSettingsRef.current = null;

            await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
                viewerSettings: newViewerSettings,
                lastUpdate: Date.now()
            } as any);
        }, 300); // 300ms debounce
    };

    // --- RENDERERS ---

    if (view === 'select_studio') {
        return (
            <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black">Välj skärm</h2>
                    <button onClick={onBack} className="p-2 bg-gray-800 rounded-full"><CloseIcon className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                    {selectedOrganization?.studios.map(studio => (
                        <button
                            key={studio.id}
                            onClick={async () => {
                                setConnectedStudioId(studio.id);
                                setView('dashboard');
                                
                                // Immediately mark as connected in Firebase
                                if (selectedOrganization) {
                                    await updateStudioRemoteState(selectedOrganization.id, studio.id, {
                                        controllerName: currentControllerName,
                                        lastUpdate: Date.now()
                                    } as any);
                                }
                            }}
                            className="w-full p-6 bg-gray-800 rounded-3xl border border-gray-700 flex items-center justify-between hover:bg-gray-750 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                                    <LightningIcon className="w-6 h-6 text-primary" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg">{studio.name}</h3>
                                    <p className="text-xs text-gray-500 uppercase tracking-widest">
                                        {studio.remoteState?.controllerName 
                                            ? <span className="text-primary animate-pulse">{studio.remoteState.controllerName} uppkopplad</span>
                                            : (studio.remoteState?.status === TimerStatus.Running ? 'Träning pågår' : 'Redo')
                                        }
                                    </p>
                                </div>
                            </div>
                            <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

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
                            {/* 1. Configured Categories (Mapped to match Studio View order) */}
                            {studioConfig.customCategories.map(cat => (
                                <DashboardButton 
                                    key={cat.id}
                                    onClick={() => { setSelectedCategory(cat.name); setView('list'); }}
                                    icon={<DumbbellIcon className="w-8 h-8" />}
                                    label={cat.name}
                                />
                            ))}
                            
                             {/* 2. HYROX (if enabled) */}
                             {studioConfig.enableHyrox && (
                                <DashboardButton 
                                    onClick={() => { setSelectedCategory('HYROX'); setView('list'); }}
                                    icon={<LightningIcon className="w-8 h-8" />}
                                    label="HYROX"
                                />
                            )}

                             {/* 3. Timer (Renamed from Fristående Timer) */}
                            <DashboardButton 
                                onClick={() => setView('timer_setup')}
                                icon={<ClockIcon className="w-8 h-8" />}
                                label="Timer"
                            />

                             {/* 4. Other Workouts */}
                            <DashboardButton 
                                onClick={() => { setSelectedCategory('other'); setView('list'); }}
                                icon={<StarIcon className="w-8 h-8" />}
                                label="Övriga Pass"
                            />
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
                                    <div className="p-4 bg-gray-800 border-t border-gray-700 rounded-2xl grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => setView('edit')}
                                            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                            Anpassa
                                        </button>
                                        <button 
                                            onClick={handleCastWorkout}
                                            className="bg-primary hover:brightness-110 text-white font-black py-4 rounded-xl text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            Visa på skärm
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

    if (view === 'edit' && selectedWorkout) {
        return (
            <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
                <SimpleWorkoutBuilderScreen 
                    initialWorkout={selectedWorkout}
                    onSave={async (modifiedWorkout) => {
                        if (!selectedOrganization || !connectedStudioId) return;
                        
                        // Create a temporary copy
                        const workoutToSave: Workout = {
                            ...modifiedWorkout,
                            id: `custom-${Date.now()}`,
                            title: `Anpassat: ${modifiedWorkout.title}`,
                            isMemberDraft: true,
                            organizationId: selectedOrganization.id,
                            createdAt: Date.now()
                        };

                        await saveWorkout(workoutToSave);
                        setSelectedWorkout(workoutToSave);
                        
                        // Load on screen
                        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
                            activeWorkoutId: workoutToSave.id,
                            view: 'preview',
                            activeBlockId: null,
                            lastUpdate: Date.now(),
                            controllerName: currentControllerName
                        });
                        
                        setView('list');
                    }}
                    onCancel={() => setView('list')}
                />
            </div>
        );
    }

    if (view === 'controls') {
        return (
            <div className="fixed inset-0 bg-black text-white z-50 flex flex-col animate-fade-in">
                 {/* Mini Header */}
                 <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center relative z-20 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live på {connectedStudioName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExitSession} className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">Tillbaka</button>
                    </div>
                </div>

                {/* Compact Info Header */}
                 <div className="px-6 py-4 bg-gray-900/50 flex-shrink-0">
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Nu visas</p>
                    <h1 className="text-xl font-black leading-tight text-white">{selectedWorkout?.title}</h1>
                    {selectedWorkout?.coachTips && <p className="text-gray-400 text-xs mt-1 line-clamp-1">{selectedWorkout.coachTips}</p>}
                </div>

                {/* Controls - Block List */}
                {selectedWorkout && selectedWorkout.category !== 'Fristående' && (
                    <div className="flex-grow flex flex-col bg-black min-h-0">
                        <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar flex-grow">
                            {selectedWorkout.blocks.map((block, i) => {
                                const isExpanded = expandedBlockId === block.id;
                                const isRunning = activeRunningBlockId === block.id;
                                
                                return (
                                    <div 
                                        key={block.id} 
                                        className={`rounded-2xl transition-all border ${isRunning ? 'bg-gray-900 border-primary/50 shadow-sm shadow-primary/10' : 'bg-gray-900 border-gray-800'}`}
                                    >
                                        {/* Block Header (Click to Expand) */}
                                        <button 
                                            onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                                            className="w-full p-4 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isRunning ? 'bg-primary text-white' : 'bg-gray-800 text-gray-500'}`}>
                                                    {i+1}
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold text-sm ${isRunning ? 'text-primary' : 'text-white'}`}>{block.title}</h4>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span className="uppercase">{block.tag}</span>
                                                        <span>•</span>
                                                        <span>{block.settings.mode}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
                                        </button>

                                        {/* Expanded Controls */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden border-t border-gray-800"
                                                >
                                                    <div className="p-4 space-y-3">
                                                        {isRunning ? (
                                                            // Controls for ACTIVE block (State B)
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {(() => {
                                                                    const studio = selectedOrganization?.studios.find(s => s.id === connectedStudioId);
                                                                    const isTimerRunning = studio?.remoteState?.status === TimerStatus.Running || 
                                                                                         studio?.remoteState?.status === TimerStatus.Preparing || 
                                                                                         studio?.remoteState?.status === TimerStatus.Resting;
                                                                    
                                                                    return (
                                                                        <button 
                                                                            onClick={() => sendCommand(isTimerRunning ? 'pause' : 'start')} 
                                                                            disabled={isSendingCommand !== null}
                                                                            className={`${isTimerRunning ? 'bg-gray-700' : 'bg-green-600 hover:bg-green-500'} p-6 rounded-2xl font-bold text-white flex flex-col items-center gap-1 col-span-2 shadow-lg transition-all active:scale-95 disabled:opacity-50`}
                                                                        >
                                                                            <span className="text-3xl">
                                                                                {isTimerRunning ? '⏸' : <PlayIcon className="w-8 h-8 fill-current" />}
                                                                            </span>
                                                                            <span className="text-xs uppercase tracking-widest">
                                                                                {isTimerRunning ? 'Pausa' : 'Starta / Fortsätt'}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })()}
                                                                
                                                                <button 
                                                                    onClick={() => sendCommand('pause')} 
                                                                    disabled={isSendingCommand !== null}
                                                                    className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl font-bold text-white flex flex-col items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <span className="text-xl">⏸</span>
                                                                    <span className="text-[10px] uppercase">Pausa</span>
                                                                </button>
                                                                
                                                                 <button 
                                                                    onClick={() => sendCommand('reset')} 
                                                                    disabled={isSendingCommand !== null}
                                                                    className="bg-gray-800 hover:bg-gray-700 p-4 rounded-xl font-bold text-yellow-500 flex flex-col items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <span className="text-xl"><RefreshIcon className="w-5 h-5" /></span>
                                                                    <span className="text-[10px] uppercase">Nollställ</span>
                                                                </button>

                                                                <button onClick={handleCloseBlock} className="col-span-2 mt-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900 text-red-400 p-3 rounded-xl font-bold text-xs uppercase tracking-wider">
                                                                    Stäng block
                                                                </button>

                                                                {/* VIEW SETTINGS (Embedded) */}
                                                                <div className="col-span-2 mt-4 pt-4 border-t border-gray-800">
                                                                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-3 text-center">Justera Vy</p>
                                                                    
                                                                    <div className="space-y-4">
                                                                        {/* Text Size */}
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-xs font-bold text-gray-400 w-8">Text</span>
                                                                            <input 
                                                                                type="range" 
                                                                                min="0.5" 
                                                                                max="2.0" 
                                                                                step="0.1" 
                                                                                value={localTextScale ?? selectedOrganization?.studios.find(s => s.id === connectedStudioId)?.remoteState?.viewerSettings?.textScale ?? 1} 
                                                                                onChange={(e) => handleUpdateViewSettings('text', parseFloat(e.target.value))}
                                                                                className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                                                            />
                                                                            <span className="text-xs font-mono text-gray-400 w-8 text-right">{Math.round((localTextScale ?? selectedOrganization?.studios.find(s => s.id === connectedStudioId)?.remoteState?.viewerSettings?.textScale ?? 1) * 100)}%</span>
                                                                        </div>

                                                                        {/* Reps Size */}
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-xs font-bold text-gray-400 w-8">Reps</span>
                                                                            <input 
                                                                                type="range" 
                                                                                min="0.5" 
                                                                                max="2.5" 
                                                                                step="0.1" 
                                                                                value={localRepsScale ?? selectedOrganization?.studios.find(s => s.id === connectedStudioId)?.remoteState?.viewerSettings?.repsScale ?? 1} 
                                                                                onChange={(e) => handleUpdateViewSettings('reps', parseFloat(e.target.value))}
                                                                                className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                                                            />
                                                                            <span className="text-xs font-mono text-gray-400 w-8 text-right">{Math.round((localRepsScale ?? selectedOrganization?.studios.find(s => s.id === connectedStudioId)?.remoteState?.viewerSettings?.repsScale ?? 1) * 100)}%</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex justify-center">
                                                                             <button 
                                                                                onClick={() => {
                                                                                    handleUpdateViewSettings('text', 1);
                                                                                    handleUpdateViewSettings('reps', 1);
                                                                                }}
                                                                                className="text-[10px] text-gray-600 hover:text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1"
                                                                            >
                                                                                <RefreshIcon className="w-3 h-3" /> Återställ
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Load button for INACTIVE block (State A)
                                                            <button 
                                                                onClick={() => handleLoadBlock(block)}
                                                                className="w-full bg-primary hover:brightness-110 text-white font-black py-6 rounded-xl shadow-lg shadow-primary/20 text-lg uppercase tracking-widest flex items-center justify-center gap-3"
                                                            >
                                                                <LightningIcon className="w-6 h-6" />
                                                                Ladda på skärm
                                                            </button>
                                                        )}
                                                        
                                                        {/* Exercises List (Mini) */}
                                                        <div className="mt-4 pt-4 border-t border-gray-800">
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Innehåll</p>
                                                            <ul className="space-y-1">
                                                                {block.exercises.map((ex, idx) => (
                                                                    <li key={idx} className="text-xs text-gray-400 flex justify-between">
                                                                        <span>{ex.name}</span>
                                                                        <span className="text-gray-600">{ex.reps}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {/* Fallback controls for Freestanding or if something breaks */}
                {(!selectedWorkout || selectedWorkout.category === 'Fristående') && (
                     <div className="p-6 flex flex-col items-center justify-center h-full">
                        <div className="flex gap-6">
                            <button onClick={() => sendCommand('pause')} className="p-6 bg-gray-800 rounded-full"><span className="text-3xl">⏸</span></button>
                            <button onClick={() => sendCommand('start')} className="p-8 bg-primary rounded-full shadow-lg shadow-primary/30"><PlayIcon className="w-12 h-12 text-white" /></button>
                            <button onClick={() => sendCommand('finish')} className="p-6 bg-gray-800 rounded-full text-red-500"><span className="text-xl font-black">STOP</span></button>
                        </div>
                        <p className="mt-8 text-gray-500 text-sm">Fristående Timer</p>
                     </div>
                )}
            </div>
        );
    }

    return null;
};
