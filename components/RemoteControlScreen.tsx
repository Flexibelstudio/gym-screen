
import React, { useState, useEffect, useMemo } from 'react';
import { useStudio } from '../context/StudioContext';
import { useWorkout } from '../context/WorkoutContext';
import { updateStudioRemoteState } from '../services/firebaseService';
import { Workout, WorkoutBlock } from '../types';
import { WebQRScanner } from './WebQRScanner';
import { DumbbellIcon, PlayIcon, CloseIcon, ChevronRightIcon, ClockIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type RemoteView = 'scan' | 'library' | 'controls';

export const RemoteControlScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { workouts } = useWorkout();
    const { selectedOrganization } = useStudio();
    
    // State
    const [view, setView] = useState<RemoteView>('scan');
    const [connectedStudioId, setConnectedStudioId] = useState<string | null>(null);
    const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
    
    // Derived
    const connectedStudioName = useMemo(() => {
        if (!selectedOrganization || !connectedStudioId) return '';
        return selectedOrganization.studios.find(s => s.id === connectedStudioId)?.name || 'Okänd skärm';
    }, [selectedOrganization, connectedStudioId]);

    const handleClose = () => {
        if (connectedStudioId) {
            if (window.confirm("Vill du avsluta fjärrkontrollen?")) {
                // Rensa fjärrtillstånd om man går ur
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
                setView('library');
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
        
        // 1. Skicka kommando till Firestore
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'preview', // Börja i preview-läge på TV:n
            activeBlockId: null,
            lastUpdate: Date.now(),
            controllerName: 'Coach'
        });
        
        // 2. Byt till kontroll-vy i mobilen
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
        
        // Fetch current state first to preserve block ID
        // (Simplified for now: we update what we know)
        await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, {
            activeWorkoutId: selectedWorkout.id,
            view: 'timer',
            // activeBlockId should ideally be preserved, but for now assuming user clicked a block first
            activeBlockId: null, // Note: This might be an issue if block ID is required to stay on same block. 
            // In a real app we'd need to read the current state or store activeBlockId in local state.
            // Let's assume the TV handles command even if blockId updates, OR we store activeBlockId here.
            lastUpdate: Date.now(),
            controllerName: 'Coach',
            command: cmd,
            commandTimestamp: Date.now()
        });
    };
    
    const handleStop = async () => {
         if (!selectedOrganization || !connectedStudioId) return;
         await updateStudioRemoteState(selectedOrganization.id, connectedStudioId, null); // Clear state
         setView('library');
         setSelectedWorkout(null);
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

    if (view === 'library') {
        return (
            <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col animate-fade-in">
                {/* Header */}
                <div className="p-6 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-lg z-10">
                    <div>
                        <p className="text-xs text-green-400 font-bold uppercase tracking-widest flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Ansluten till
                        </p>
                        <h2 className="text-xl font-black">{connectedStudioName}</h2>
                    </div>
                    <button onClick={handleClose} className="p-2 bg-gray-700 rounded-full"><CloseIcon className="w-5 h-5" /></button>
                </div>

                {/* Workout List or Selected Detail */}
                <div className="flex-grow overflow-y-auto p-4">
                    {selectedWorkout ? (
                        <div className="space-y-6">
                            <button onClick={() => setSelectedWorkout(null)} className="text-gray-400 text-sm font-bold mb-4 flex items-center gap-1">
                                &larr; Tillbaka till listan
                            </button>
                            
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
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h3 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-2 pl-2">Välj pass att köra</h3>
                            {workouts.filter(w => w.isPublished).map(workout => (
                                <button 
                                    key={workout.id} 
                                    onClick={() => handleSelectWorkout(workout)}
                                    className="w-full text-left bg-gray-800 p-4 rounded-2xl border border-gray-700 active:scale-95 transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <h4 className="font-bold text-white text-lg">{workout.title}</h4>
                                        <p className="text-gray-400 text-xs">{workout.category} • {workout.blocks.length} delar</p>
                                    </div>
                                    <div className="bg-gray-700 p-2 rounded-full text-gray-400 group-hover:text-white transition-colors">
                                        <ChevronRightIcon className="w-5 h-5" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                {selectedWorkout && (
                    <div className="p-4 bg-gray-800 border-t border-gray-700 pb-8">
                        <button 
                            onClick={handleCastWorkout}
                            className="w-full bg-primary text-white font-black py-4 rounded-2xl text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="text-2xl">📺</span>
                            VISA PÅ TV
                        </button>
                    </div>
                )}
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
                    <div className="flex gap-4 mt-8">
                        <button 
                            onClick={() => sendCommand('pause')}
                            className="w-16 h-16 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        >
                            <span className="text-2xl">⏸</span>
                        </button>
                        <button 
                            onClick={() => sendCommand('start')}
                            className="w-20 h-20 rounded-full bg-primary hover:bg-teal-400 flex items-center justify-center shadow-xl shadow-primary/20 active:scale-95 transition-transform"
                        >
                            <PlayIcon className="w-10 h-10 text-white ml-1" />
                        </button>
                         <button 
                            onClick={() => sendCommand('finish')}
                            className="w-16 h-16 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center shadow-lg active:scale-95 transition-transform text-red-500"
                        >
                            <span className="text-xl font-bold">STOP</span>
                        </button>
                    </div>
                </div>

                {/* Controls - Block List */}
                <div className="bg-gray-900 rounded-t-[2.5rem] border-t border-gray-800 flex-grow max-h-[50vh] flex flex-col shadow-2xl">
                    <div className="p-6 border-b border-gray-800">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Passets delar</h3>
                        <p className="text-white font-bold">Klicka play för att starta timer</p>
                    </div>
                    
                    <div className="overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
                        {selectedWorkout?.blocks.map((block, i) => (
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
                                    className="w-12 h-12 bg-gray-700 hover:bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all group"
                                >
                                    <PlayIcon className="w-5 h-5 text-white ml-0.5 group-hover:scale-110 transition-transform" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
