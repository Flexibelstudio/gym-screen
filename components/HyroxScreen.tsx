
import React, { useState, useEffect, useRef } from 'react';
import { Page, Workout, WorkoutBlock, TimerMode, Exercise, StudioConfig, StartGroup, HyroxRace } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';
import { useStudio } from '../context/StudioContext';
import { getPastRaces } from '../services/firebaseService';
import { CalendarIcon, UsersIcon } from './icons';

const RACE_CONFIG_STORAGE_KEY = 'hyrox-custom-race-config';

const createDefaultExercises = (): Exercise[] => {
    const stations = [
        { name: 'SkiErg', reps: '1000m' },
        { name: 'Sled Push', reps: '50m' },
        { name: 'Sled Pull', reps: '50m' },
        { name: 'Burpee Broad Jumps', reps: '80m' },
        { name: 'Row', reps: '1000m' },
        { name: 'Farmers Carry', reps: '200m' },
        { name: 'Sandbag Lunges', reps: '100m' },
        { name: 'Wall Balls', reps: '100' },
    ];
    
    const raceStages: Exercise[] = [];
    for (let i = 0; i < 8; i++) {
        raceStages.push({ id: `default-run-${i}`, name: 'Löpning', reps: '1000m', description: '' });
        raceStages.push({ id: `default-station-${i}`, name: stations[i].name, reps: stations[i].reps, description: '' });
    }
    return raceStages;
};

const RaceEditor: React.FC<{
    onSave: (config: { name: string; exercises: Exercise[] }) => void;
    onCancel: () => void;
}> = ({ onSave, onCancel }) => {
    const [raceName, setRaceName] = useState('HYROX Race');
    const [exercises, setExercises] = useState<Exercise[]>([]);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        try {
            const savedConfig = localStorage.getItem(RACE_CONFIG_STORAGE_KEY);
            if (savedConfig) {
                const { name, exercises: savedExercises } = JSON.parse(savedConfig);
                setRaceName(name);
                setExercises(savedExercises);
            } else {
                setExercises(createDefaultExercises());
            }
        } catch (error) {
            console.error("Failed to load race config from localStorage", error);
            setExercises(createDefaultExercises());
        }
    }, []);

    const handleSave = () => {
        const config = { name: raceName.trim() || 'Anpassat Race', exercises };
        localStorage.setItem(RACE_CONFIG_STORAGE_KEY, JSON.stringify(config));
        onSave(config);
    };
    
    const handleExerciseChange = (index: number, field: 'name' | 'reps', value: string) => {
        const newExercises = [...exercises];
        newExercises[index] = { ...newExercises[index], [field]: value };
        setExercises(newExercises);
    };

    const handleAddExercise = () => {
        const newExercise: Exercise = { id: `ex-${Date.now()}`, name: '', reps: '' };
        setExercises([...exercises, newExercise]);
    };

    const handleRemoveExercise = (indexToRemove: number) => {
        setExercises(exercises.filter((_, index) => index !== indexToRemove));
    };

    const handleDragStart = (index: number) => { dragItem.current = index; };
    const handleDragEnter = (index: number) => { dragOverItem.current = index; };
    const handleDragEnd = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            const newExercises = [...exercises];
            const [draggedItem] = newExercises.splice(dragItem.current, 1);
            newExercises.splice(dragOverItem.current, 0, draggedItem);
            setExercises(newExercises);
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };


    return (
        <motion.div
            className="w-full max-w-4xl mx-auto text-left bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-gray-700 space-y-6"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
        >
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white">Redigera race</h1>
            <div>
                <label htmlFor="race-name" className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Racets namn</label>
                <input
                    id="race-name"
                    type="text"
                    value={raceName}
                    onChange={(e) => setRaceName(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-black/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 p-3 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Stationer</h3>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                    {exercises.map((ex, index) => (
                        <div
                            key={ex.id || index}
                            className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-900/50 rounded-md border border-gray-200 dark:border-gray-700"
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div className="cursor-grab text-gray-500 hover:text-gray-900 dark:hover:text-white p-2">☰</div>
                            <span className="font-mono text-gray-500 w-8 text-center">{index + 1}.</span>
                            <input
                                type="text"
                                value={ex.reps || ''}
                                onChange={(e) => handleExerciseChange(index, 'reps', e.target.value)}
                                placeholder="Antal/Distans"
                                className="w-32 bg-transparent text-gray-900 dark:text-white focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 p-1 rounded"
                            />
                            <input
                                type="text"
                                value={ex.name || ''}
                                onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                                placeholder="Stationsnamn"
                                className="flex-grow bg-transparent text-gray-900 dark:text-white focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 p-1 rounded"
                            />
                            <button onClick={() => handleRemoveExercise(index)} className="text-red-500 hover:text-red-400 font-bold p-2 text-xl">&times;</button>
                        </div>
                    ))}
                </div>
            </div>

            <button onClick={handleAddExercise} className="w-full text-center py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                + Lägg till station
            </button>
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-4">
                <button onClick={onCancel} className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                <button onClick={handleSave} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg">Spara & fortsätt</button>
            </div>
        </motion.div>
    );
};


interface HyroxScreenProps {
    navigateTo: (page: Page) => void;
    onSelectWorkout: (workout: Workout) => void;
    studioConfig: StudioConfig;
    racePrepState: { groups: StartGroup[]; interval: number } | null;
    onPrepComplete: () => void;
    remoteCommand?: { type: string, timestamp: number } | null;
    isStudioMode?: boolean;
}

const StartGroupPrepModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onStart: (groups: StartGroup[], interval: number, openAsOfficial?: boolean) => void;
    initialGroups?: StartGroup[];
    initialInterval?: number;
    isStudioMode?: boolean;
}> = ({ isOpen, onClose, onStart, initialGroups, initialInterval, isStudioMode }) => {
    const [groups, setGroups] = useState<StartGroup[]>(() => {
        if (initialGroups && initialGroups.length > 0) {
            return initialGroups.map(g => {
                const legacyParticipantsText = g.participants || (g.participantList ? g.participantList.map(p => p.partnerName ? `${p.name} & ${p.partnerName}` : p.name).join('\n') : '');
                return {
                    ...g,
                    participants: legacyParticipantsText
                };
            });
        }
        return [{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: '' }];
    });
    
    const [intervalMins, setIntervalMins] = useState(() => Math.floor(initialInterval || 2));
    const [intervalSecs, setIntervalSecs] = useState(() => Math.round(((initialInterval || 2) % 1) * 60));

    const handleAddGroup = () => {
        setGroups(prev => [...prev, { id: `group-${Date.now()}`, name: `Startgrupp ${prev.length + 1}`, participants: '' }]);
    };

    const handleRemoveGroup = (idToRemove: string) => {
        setGroups(prev => prev.filter(g => g.id !== idToRemove));
    };

    const handleGroupChange = (id: string, field: 'name' | 'participants', value: string) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleStartRace = (openAsOfficial: boolean = false) => {
        const totalMinutes = intervalMins + (intervalSecs / 60);
        onStart(groups, Math.max(0.01, totalMinutes), openAsOfficial);
    };

    const footerContent = (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button onClick={onClose} className="px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold rounded-xl transition-colors text-sm">
                Avbryt
            </button>
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
                {isStudioMode ? (
                    <button 
                        onClick={() => handleStartRace(false)} 
                        className="flex-1 bg-primary hover:brightness-95 text-white font-black py-3 px-4 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-1.5"
                    >
                        Till startsida
                    </button>
                ) : (
                    <button 
                        onClick={() => handleStartRace(true)} 
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-4 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-1.5"
                    >
                        Öppna som Funktionär
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Förbered Startgrupper"
            size="2xl"
            footer={footerContent}
        >
            <div className="flex flex-col h-full -mx-4 -my-4">
                <div className="flex-grow overflow-y-auto space-y-4 p-4">
                    {groups.map((group) => (
                        <div key={group.id} className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-2">
                                <input
                                    type="text"
                                    value={group.name}
                                    onChange={(e) => handleGroupChange(group.id, 'name', e.target.value)}
                                    className="bg-transparent font-semibold text-gray-900 dark:text-white focus:outline-none p-1 text-lg"
                                />
                                {groups.length > 1 && (
                                    <button onClick={() => handleRemoveGroup(group.id)} className="text-sm text-red-500 hover:text-red-400 font-semibold">
                                        Ta bort
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={group.participants}
                                onChange={(e) => handleGroupChange(group.id, 'participants', e.target.value)}
                                placeholder="Deltagare eller lag (ett namn per rad)"
                                rows={4}
                                className="w-full bg-white dark:bg-black/50 text-base text-gray-700 dark:text-gray-300 p-2 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none resize-y"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-1">t.ex. Tindra & Alva eller Team Olivia</p>
                        </div>
                    ))}
                </div>

                <div className="flex-shrink-0 pt-6 border-t border-gray-200 dark:border-gray-700 px-4">
                     <button onClick={handleAddGroup} className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-3 rounded-lg transition-colors mb-4">
                        + Lägg till startgrupp
                    </button>
                    <div className="my-4 text-center">
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Startintervall mellan grupper
                        </label>
                        <div className="flex items-center justify-center gap-3">
                             <div className="flex items-center gap-1.5">
                                 <input
                                    id="start-interval-mins"
                                    type="number"
                                    value={intervalMins}
                                    onChange={(e) => setIntervalMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    min="0"
                                    className="w-16 bg-white dark:bg-black/50 text-gray-900 dark:text-white text-center p-2.5 rounded-xl border border-gray-300 dark:border-gray-650 focus:ring-1 focus:ring-primary focus:outline-none font-bold"
                                />
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">min</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                                 <input
                                    id="start-interval-secs"
                                    type="number"
                                    value={intervalSecs}
                                    onChange={(e) => setIntervalSecs(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                                    min="0"
                                    max="59"
                                    className="w-16 bg-white dark:bg-black/50 text-gray-900 dark:text-white text-center p-2.5 rounded-xl border border-gray-300 dark:border-gray-650 focus:ring-1 focus:ring-primary focus:outline-none font-bold"
                                />
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">sek</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const createCustomRaceWorkout = (
    config: { name: string; exercises: Exercise[] },
    groups: StartGroup[],
    interval: number,
    organizationId: string
): Workout => {
    const now = Date.now();
    
    const processedExercises = config.exercises.map((ex, index) => ({
        ...ex,
        id: ex.id && !ex.id.startsWith('default-') ? ex.id : `ex-${index}-${now}`
    }));

    const singleBlock: WorkoutBlock = {
        id: `block-custom-race-${now}`,
        title: config.name,
        tag: 'Kondition',
        setupDescription: 'Utför alla stationer i ordning och i din egen takt. Klockan räknar uppåt till målgång.',
        followMe: false,
        settings: {
            mode: TimerMode.Stopwatch,
            workTime: 180 * 60, // 3-hour max time
            restTime: 0,
            rounds: 1,
            prepareTime: 10,
        },
        exercises: processedExercises,
    };

    const processedGroups = groups.map(g => {
        // Om fritextfältet med deltagare är tomt men det redan finns en strukturerad deltagarlista (t.ex. skapat i admin), behåll den!
        if ((!g.participants || !g.participants.trim()) && g.participantList && g.participantList.length > 0) {
            return g;
        }

        const names = (g.participants || '').split('\n').map(p => p.trim()).filter(Boolean);
        const oldParticipants = g.participantList || [];
        const newParticipantList = names.map((name, index) => {
            const existing = oldParticipants.find(p => {
                const combinedName = p.partnerName ? `${p.name} & ${p.partnerName}` : p.name;
                if (combinedName.toLowerCase() === name.toLowerCase()) return true;
                if (p.name.toLowerCase() === name.toLowerCase()) return true;
                const normalizedLine = name.toLowerCase().replace(/\s+/g, '');
                const normalizedCombined = combinedName.toLowerCase().replace(/\s+/g, '');
                if (normalizedLine === normalizedCombined) return true;
                if (p.partnerName) {
                    const hasMain = name.toLowerCase().includes(p.name.toLowerCase());
                    const hasPartner = name.toLowerCase().includes(p.partnerName.toLowerCase());
                    if (hasMain && hasPartner) return true;
                }
                return false;
            });

            if (existing) return existing;

            let parsedName = name;
            let parsedPartnerName: string | undefined = undefined;
            if (name.includes(' & ')) {
                const parts = name.split(' & ');
                parsedName = parts[0].trim();
                parsedPartnerName = parts[1].trim();
            } else if (name.includes(' och ')) {
                const parts = name.split(' och ');
                parsedName = parts[0].trim();
                parsedPartnerName = parts[1].trim();
            }

            return {
                id: `p-new-${Date.now()}-${index}`,
                name: parsedName,
                partnerName: parsedPartnerName,
                startNumber: index + 1
            };
        });

        return {
            ...g,
            participantList: newParticipantList
        };
    });

    const allParticipants = processedGroups.flatMap(g => g.participantList || []).map(p => p.partnerName ? `${p.name} & ${p.partnerName}` : p.name);

    const workout: Workout = {
        id: `custom-race-${now}`,
        title: config.name,
        coachTips: `Detta är ett anpassat lopp med uppräknande klocka. Klicka på "I Mål" för deltagare för att spara deras tider. Lycka till!`,
        blocks: [singleBlock],
        category: 'HYROX',
        isPublished: false,
        participants: allParticipants,
        startGroups: processedGroups,
        startIntervalMinutes: interval,
        createdAt: now,
        organizationId: organizationId 
    };

    return workout;
};


export const HyroxScreen: React.FC<HyroxScreenProps> = ({ navigateTo, onSelectWorkout, studioConfig, racePrepState, onPrepComplete, remoteCommand, isStudioMode }) => {
    const { selectedOrganization, selectedStudio } = useStudio();
    const [view, setView] = useState<'hub' | 'editor' | 'prep'>('hub');
    const [plannedRaces, setPlannedRaces] = useState<HyroxRace[]>([]);
    const lastProcessedCommandRef = useRef<number>(0);

    useEffect(() => {
        if (selectedOrganization) {
            getPastRaces(selectedOrganization.id).then(races => {
                const planned = races.filter(r => 
                    r.status !== 'completed' && 
                    (!r.results || r.results.length === 0) &&
                    (!r.studioId || !selectedStudio || r.studioId === selectedStudio.id)
                );
                setPlannedRaces(planned);
            }).catch(console.error);
        }
    }, [selectedOrganization, selectedStudio]);

    useEffect(() => {
        if (remoteCommand && remoteCommand.type === 'start_hyrox' && remoteCommand.timestamp > lastProcessedCommandRef.current) {
            lastProcessedCommandRef.current = remoteCommand.timestamp;
            if (plannedRaces.length > 0) {
                handleStartPlannedRace(plannedRaces[0]);
            }
        }
    }, [remoteCommand, plannedRaces]);
    const [raceConfig, setRaceConfig] = useState<{ name: string; exercises: Exercise[] } | null>(() => {
        try {
            const savedConfig = localStorage.getItem(RACE_CONFIG_STORAGE_KEY);
            return savedConfig ? JSON.parse(savedConfig) : null;
        } catch (error) {
            console.error("Failed to load initial race config from localStorage:", error);
            return null;
        }
    });

    useEffect(() => {
        if (racePrepState) {
            setView('prep');
        }
    }, [racePrepState]);

    const handleStartPlannedRace = (race: HyroxRace) => {
        const exercises = race.exercises && race.exercises.length > 0 
            ? race.exercises.map((e, i) => ({ id: `ex-${i}`, name: e, reps: '', description: '' }))
            : createDefaultExercises();

        const config = { name: race.raceName, exercises, raceId: race.id };
        setRaceConfig(config);
        
        // Gå direkt in i loppet med sparade startgrupper och startintervall från admin
        const interval = race.startIntervalMinutes || 2;
        startFullRace(race.startGroups || [], interval, !isStudioMode, config);
    };

    const startFullRace = (groups: StartGroup[], interval: number, openAsOfficial?: boolean, customConfig?: { name: string; exercises: Exercise[] }) => {
        const configToUse = customConfig || raceConfig || { name: 'HYROX Race', exercises: createDefaultExercises() };
        const orgId = selectedOrganization?.id || '';
        
        // Check if this is a planned race by looking for it in plannedRaces
        const plannedRace = plannedRaces.find(r => r.raceName === configToUse.name || (customConfig && r.id === (customConfig as any).raceId));
        
        const raceWorkout = createCustomRaceWorkout(configToUse, groups, interval, orgId);
        if (openAsOfficial) {
            raceWorkout.openAsOfficial = true;
        }
        
        // If it's a planned race, we should use its ID so we update it instead of creating a new one
        if (plannedRace) {
            raceWorkout.id = `custom-race-${plannedRace.id}`;
        }

        onSelectWorkout(raceWorkout);
        setView('hub');
        onPrepComplete();
    };

    const handleCloseModal = () => {
        setView('hub');
        onPrepComplete();
    };

    const getParticipantCountTextInput = (groupsList?: StartGroup[]) => {
        if (!groupsList) return '0 deltagare';
        let singles = 0;
        let teams = 0;
        let totalPhysical = 0;

        groupsList.forEach(g => {
            const list = g.participantList || [];
            if (list.length > 0) {
                list.forEach(p => {
                    if (p.partnerName) {
                        teams++;
                        totalPhysical += 2;
                    } else {
                        singles++;
                        totalPhysical += 1;
                    }
                });
            } else {
                // Parse legacy lines
                const lines = g.participants ? g.participants.split('\n').filter(Boolean) : [];
                lines.forEach(name => {
                    if (name.includes('&') || name.includes('och')) {
                        teams++;
                        totalPhysical += 2;
                    } else {
                        singles++;
                        totalPhysical += 1;
                    }
                });
            }
        });

        if (teams > 0) {
            return `${totalPhysical} deltagare (${teams} lag${singles > 0 ? `, ${singles} singel` : ''})`;
        }
        return `${totalPhysical} deltagare`;
    };

    return (
        <div className="w-full max-w-5xl mx-auto text-center animate-fade-in pb-12">
            {isStudioMode && (
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
                    Kör planerade lopp och tävlingar i studion – från uppvärmning och gruppstart till målgång med full tidtagning.
                </p>
            )}
            
            {plannedRaces.length > 0 ? (
                <div className="mb-12 text-left">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tight">Planerade Event</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {plannedRaces.map(race => (
                            <div key={race.id} className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{race.raceName}</h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        <div className="flex items-center gap-1">
                                            <CalendarIcon className="w-4 h-4" />
                                            {race.scheduledDate ? new Date(race.scheduledDate).toLocaleDateString('sv-SE') : 'Inget datum'}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <UsersIcon className="w-4 h-4" />
                                            {getParticipantCountTextInput(race.startGroups)}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleStartPlannedRace(race)}
                                    className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:brightness-110 transition-all cursor-pointer text-sm"
                                >
                                    {isStudioMode ? 'Starta Event' : 'Öppna event som funktionär'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm max-w-lg mx-auto text-center my-8 animate-fade-in">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800/80 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                        🏆
                    </div>
                    <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Inga planerade event</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                        Det finns inga planerade event eller tävlingar just nu för denna studio. <br />
                        Planera och konfigurera nya event i admin-vyn under fliken <strong>Event & Tävlingar</strong>.
                    </p>
                </div>
            )}

            <AnimatePresence>
                {view === 'prep' && (
                    <StartGroupPrepModal
                        isOpen={true}
                        onClose={handleCloseModal}
                        onStart={startFullRace}
                        initialGroups={racePrepState?.groups || (plannedRaces.find(r => r.raceName === raceConfig?.name)?.startGroups)}
                        initialInterval={racePrepState?.interval}
                        isStudioMode={isStudioMode}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
