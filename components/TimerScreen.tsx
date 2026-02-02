import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout } from '../types';
import { useWorkoutTimer, playShortBeep, getAudioContext, calculateBlockDuration, playBoxingBell } from '../hooks/useWorkoutTimer';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity } from '../services/firebaseService';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation, PauseOverlay } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon, InformationCircleIcon, LightningIcon, SparklesIcon, ChevronRightIcon, ClockIcon } from './icons';

// --- Constants ---
const HYROX_RIGHT_PANEL_WIDTH = '450px';

// --- Helper Components & Interfaces ---

interface TimerStyle {
  bg: string;
  text: string;
  pulseRgb: string;
  border: string;
  badge: string;
}

const getTimerStyle = (status: TimerStatus, mode: TimerMode, isHyrox: boolean, isTransitioning: boolean): TimerStyle => {
  if (isTransitioning) {
      return { bg: 'bg-gradient-to-br from-indigo-900 to-purple-900', text: 'text-white', pulseRgb: '168, 85, 247', border: 'border-purple-400', badge: 'bg-purple-600' };
  }
  
  if (isHyrox) {
      return { bg: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 animate-pulse-hyrox-bg', text: 'text-white', pulseRgb: '255, 255, 255', border: 'border-white', badge: 'bg-white text-indigo-600' };
  }

  switch (status) {
    case TimerStatus.Preparing:
      return { bg: 'bg-blue-600', text: 'text-white', pulseRgb: '59, 130, 246', border: 'border-blue-300', badge: 'bg-blue-600' };
    case TimerStatus.Running:
      switch (mode) {
        case TimerMode.Interval: return { bg: 'bg-orange-600', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
        case TimerMode.Tabata: return { bg: 'bg-red-600', text: 'text-white', pulseRgb: '239, 68, 68', border: 'border-red-300', badge: 'bg-red-600' };
        case TimerMode.AMRAP: return { bg: 'bg-pink-600', text: 'text-white', pulseRgb: '219, 39, 119', border: 'border-pink-300', badge: 'bg-pink-700' };
        case TimerMode.EMOM: return { bg: 'bg-purple-600', text: 'text-white', pulseRgb: '147, 51, 234', border: 'border-purple-300', badge: 'bg-purple-700' };
        case TimerMode.TimeCap: return { bg: 'bg-indigo-600', text: 'text-white', pulseRgb: '79, 70, 229', border: 'border-indigo-300', badge: 'bg-indigo-700' };
        case TimerMode.Stopwatch: return { bg: 'bg-green-600', text: 'text-white', pulseRgb: '22, 163, 74', border: 'border-green-300', badge: 'bg-green-700' };
        default: return { bg: 'bg-orange-600', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
      }
    case TimerStatus.Resting:
      return { bg: 'bg-teal-500', text: 'text-white', pulseRgb: '45, 212, 191', border: 'border-teal-200', badge: 'bg-teal-600' };
    case TimerStatus.Paused:
      return { bg: 'bg-gray-600', text: 'text-white', pulseRgb: '107, 114, 128', border: 'border-gray-400', badge: 'bg-gray-600' };
    case TimerStatus.Finished:
      return { bg: 'bg-teal-700', text: 'text-white', pulseRgb: '13, 148, 136', border: 'border-teal-400', badge: 'bg-teal-800' };
    case TimerStatus.Idle:
    default:
      return { bg: 'bg-gray-900', text: 'text-white', pulseRgb: '0, 0, 0', border: 'border-gray-700', badge: 'bg-gray-800' };
  }
};

const getTagHexColor = (tag: string) => {
    switch (tag.toLowerCase()) {
        case 'styrka': return '#ef4444'; // Red
        case 'kondition': return '#3b82f6'; // Blue
        case 'rörlighet': return '#14b8a6'; // Teal
        case 'teknik': return '#a855f7'; // Purple
        case 'core': case 'bål': return '#eab308'; // Yellow
        default: return '#14b8a6';
    }
};

const formatReps = (reps: string | undefined): string => {
    if (!reps) return '';
    const trimmed = reps.trim();
    if (!trimmed) return '';
    const isNumericLike = /^[\d\s\-\.,/]+$/.test(trimmed);
    if (isNumericLike) return `${trimmed} reps`;
    return trimmed;
};

const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getBlockTimeLabel = (block: WorkoutBlock): string => {
    const s = block.settings;
    if (!s) return "";
    
    switch(s.mode) {
        case TimerMode.AMRAP:
        case TimerMode.TimeCap:
            return s.workTime ? `${Math.floor(s.workTime / 60)} MIN` : "";
        case TimerMode.EMOM:
            return s.rounds ? `${s.rounds} MIN` : "";
        case TimerMode.Tabata:
            return s.rounds ? `${s.rounds} RONDER` : "";
        case TimerMode.Interval:
            return s.rounds ? `${s.rounds} RONDER` : "";
        default:
            return "";
    }
};

// --- Visualization Components ---

const NextRestPreview: React.FC<{ transitionTime: number; isCompact?: boolean }> = ({ transitionTime, isCompact = false }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${isCompact ? 'flex-1' : 'flex-1'} flex flex-col bg-white/95 dark:bg-black/40 backdrop-blur-2xl rounded-[3rem] border-2 border-gray-100 dark:border-white/10 shadow-2xl p-10 justify-center text-center`}
        >
            <div className="flex flex-col items-center gap-4 mb-6">
                <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
                    <ClockIcon className="w-10 h-10 text-primary" />
                </div>
                <div>
                    <span className="block text-sm font-black text-gray-400 dark:text-white/40 uppercase tracking-[0.4em] mb-2">HÄRNÄST</span>
                    <h4 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">VILA</h4>
                </div>
            </div>
            
            <div className="text-[10rem] font-mono font-black text-primary dark:text-primary tabular-nums drop-shadow-xl leading-none">
                {formatSeconds(transitionTime)}
            </div>
        </motion.div>
    );
};

const NextUpCompactBar: React.FC<{ transitionTime?: number; block?: WorkoutBlock; isRestNext?: boolean }> = ({ transitionTime, block, isRestNext }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-white/95 dark:bg-black/40 backdrop-blur-xl rounded-[2.5rem] border-2 border-gray-100 dark:border-white/10 p-8 flex items-center justify-between shadow-2xl mt-4"
        >
            <div className="flex items-center gap-6">
                <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
                    {isRestNext ? <ClockIcon className="w-10 h-10 text-primary" /> : <ChevronRightIcon className="w-10 h-10 text-primary" />}
                </div>
                <div>
                    <span className="block text-[12px] font-black text-gray-400 dark:text-white/40 uppercase tracking-[0.4em] mb-1.5">HÄRNÄST</span>
                    <h5 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
                        {isRestNext ? 'VILA' : block?.title}
                    </h5>
                </div>
            </div>

            <div className="flex items-center gap-8">
                {transitionTime !== undefined && transitionTime > 0 ? (
                    <div className="text-6xl font-mono font-black text-primary tabular-nums drop-shadow-xl">
                        {formatSeconds(transitionTime)}
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                         <span className="text-sm font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-white/60 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10">{block?.settings.mode}</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const NextBlockPreview: React.FC<{ block: WorkoutBlock; label?: string; flexClassName?: string }> = ({ block, label = "HÄRNÄST", flexClassName = "flex-1" }) => {
    const timeLabel = getBlockTimeLabel(block);
    const accentColor = getTagHexColor(block.tag);
    
    return (
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${flexClassName} flex flex-col bg-white/95 dark:bg-black/40 backdrop-blur-2xl rounded-[3rem] border-2 border-gray-100 dark:border-white/10 overflow-hidden shadow-2xl min-h-0`}
        >
            <div className="p-8 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
                <div className="flex items-center gap-4 mb-3">
                    <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                        <ChevronRightIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <span className="block text-xs font-black text-gray-400 dark:text-white/40 uppercase tracking-[0.4em] mb-1">{label}</span>
                        <h4 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter line-clamp-1 leading-none">{block.title}</h4>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-400 dark:text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                    <span className="bg-gray-200 dark:bg-white/10 px-2 py-1 rounded-md">{block.settings.mode}</span>
                    {timeLabel && (
                        <>
                            <span className="opacity-30">•</span>
                            <span className="text-primary font-black">{timeLabel}</span>
                        </>
                    )}
                </div>

                {block.setupDescription && (
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-300 leading-tight border-t border-gray-200 dark:border-white/10 pt-4 mt-2 whitespace-normal">
                        {block.setupDescription}
                    </p>
                )}
            </div>
            <div className="flex-grow flex flex-col overflow-y-auto p-4 custom-scrollbar gap-3">
                {block.exercises.map((ex) => {
                    const nameLen = ex.name.length;
                    let nameSize = 'text-3xl';
                    if (nameLen > 30) nameSize = 'text-xl';
                    else if (nameLen > 20) nameSize = 'text-2xl';
                    
                    return (
                        <div 
                            key={ex.id} 
                            className="flex-1 min-h-[80px] flex items-center gap-5 bg-gray-50/80 dark:bg-white/5 rounded-[1.8rem] p-6 border border-gray-100 dark:border-white/5 border-l-[10px] shadow-sm transition-transform active:scale-[0.98]"
                            style={{ borderLeftColor: accentColor }}
                        >
                            {ex.reps && (
                                <span className="text-sm font-black text-primary bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 whitespace-nowrap shrink-0 font-mono">
                                    {formatReps(ex.reps)}
                                </span>
                            )}
                            <p className={`font-black text-gray-900 dark:text-white leading-tight tracking-tight whitespace-normal ${nameSize}`}>
                                {ex.name}
                            </p>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};

const SegmentedRoadmap: React.FC<{ 
    chain: WorkoutBlock[]; 
    currentBlockId: string; 
    totalChainElapsed: number; 
    totalChainTime: number;
}> = ({ chain, currentBlockId, totalChainElapsed, totalChainTime }) => {
    let accumulatedTime = 0;
    
    return (
        <div className="w-full flex items-center gap-1.5 h-6 mb-1">
            {chain.map((b, i) => {
                const bDur = calculateBlockDuration(b.settings, b.exercises.length);
                const transTime = (i < chain.length - 1 && b.autoAdvance) ? (b.transitionTime || 0) : 0;
                const segmentTotal = bDur + transTime;
                
                const widthPercent = totalChainTime > 0 ? (segmentTotal / totalChainTime) * 100 : (100 / chain.length);
                const isActive = b.id === currentBlockId;
                
                const segmentStart = accumulatedTime;
                const segmentEnd = accumulatedTime + segmentTotal;
                
                let segmentProgress = 0;
                if (totalChainElapsed > segmentEnd) segmentProgress = 100;
                else if (totalChainElapsed > segmentStart) segmentProgress = ((totalChainElapsed - segmentStart) / segmentTotal) * 100;
                
                accumulatedTime += segmentTotal;

                return (
                    <div 
                        key={b.id} 
                        style={{ width: `${widthPercent}%` }} 
                        className={`h-3 rounded-full overflow-hidden border relative shadow-sm transition-all ${isActive ? 'bg-black/40 border-white/60' : 'bg-black/20 border-white/10'}`}
                    >
                        <motion.div 
                            className={`absolute inset-0 transition-colors duration-500 ${isActive ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-white/30'}`}
                            style={{ width: `${segmentProgress}%` }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

const NextStartIndicator: React.FC<{
    groupName: string;
    timeLeft: number;
    groupsLeft: number;
}> = ({ groupName, timeLeft, groupsLeft }) => {
    const minutes = Math.floor(Math.max(0, timeLeft) / 60);
    const seconds = Math.max(0, timeLeft) % 60;
    const isUrgent = timeLeft <= 30;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, height: 0 }}
            className="w-full mb-4 relative flex-shrink-0"
        >
            <div className={`bg-white/95 dark:bg-black/60 backdrop-blur-2xl rounded-[1.8rem] p-4 border-2 shadow-xl dark:shadow-2xl flex items-center justify-between transition-colors duration-500 ${isUrgent ? 'border-orange-500 shadow-orange-500/20' : 'border-gray-200 dark:border-white/10'}`}>
                <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isUrgent ? 'bg-orange-500 text-white animate-pulse' : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/40'}`}>
                        <LightningIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <span className="block text-[8px] font-black text-gray-400 dark:text-white/30 uppercase tracking-[0.3em] mb-0.5">NÄSTA START</span>
                        <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-[250px] sm:max-w-md leading-none">
                            {groupName}
                        </h4>
                        <p className="text-[8px] font-black text-gray-400 dark:text-white/20 uppercase tracking-[0.2em] mt-1">
                            {groupsLeft} {groupsLeft === 1 ? 'GRUPP' : 'GRUPPER'} KVAR
                        </p>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <span className="block text-[8px] font-black text-gray-400 dark:text-white/30 uppercase tracking-[0.3em] mb-0.5">STARTAR OM</span>
                    <div className={`font-mono text-3xl font-black tabular-nums leading-none ${isUrgent ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
                        {minutes}:{seconds.toString().padStart(2, '0')}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const FollowMeView: React.FC<{ 
    exercise: Exercise | null, 
    nextExercise: Exercise | null, 
    timerStyle: TimerStyle, 
    status: TimerStatus,
    nextBlock?: WorkoutBlock,
    transitionTime?: number,
    isRestNext?: boolean
}> = ({ exercise, nextExercise, timerStyle, status, nextBlock, transitionTime, isRestNext }) => {
    const isResting = status === TimerStatus.Resting;
    const isPreparing = status === TimerStatus.Preparing;
    const displayExercise = exercise;
    const label = (isResting || isPreparing) ? "Nästa övning" : "Aktuell övning";

    if (!displayExercise) return null;

    // Dynamisk storlek för övningsnamnet baserat på teckenantal
    const nameLen = displayExercise.name.length;
    let titleSize = 'text-6xl md:text-8xl'; // Standard
    if (nameLen > 35) titleSize = 'text-4xl md:text-6xl';
    else if (nameLen > 20) titleSize = 'text-5xl md:text-7xl';

    return (
        <div className="flex flex-col h-full items-center justify-between">
            <AnimatePresence mode="wait">
                <motion.div
                    key={displayExercise.id}
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`w-full max-w-5xl bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-2xl overflow-hidden border-l-[20px] ${isResting ? 'border-teal-400' : timerStyle.border.replace('border-', 'border-')}`}
                    style={{ borderColor: isResting ? undefined : `rgb(${timerStyle.pulseRgb})` }}
                >
                    <div className="p-10 md:p-14 flex flex-col items-center text-center">
                        <span className="block text-xl md:text-2xl font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-4">
                            {label}
                        </span>
                        <h3 className={`font-black text-gray-900 dark:text-white leading-tight mb-6 tracking-tight transition-all duration-300 ${titleSize}`}>
                            {displayExercise.name}
                        </h3>
                        {displayExercise.reps && (
                            <p className="text-5xl md:text-7xl font-black text-primary mb-6">{formatReps(displayExercise.reps)}</p>
                        )}
                        {displayExercise.description && (
                            <p className="text-gray-600 dark:text-gray-300 text-2xl md:text-4xl leading-relaxed max-w-4xl font-medium">
                                {displayExercise.description}
                            </p>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
            
            {(isRestNext || nextBlock) && (
                <div className="w-full max-w-5xl">
                    <NextUpCompactBar block={nextBlock} isRestNext={isRestNext} transitionTime={isRestNext ? transitionTime : undefined} />
                </div>
            )}
        </div>
    );
};

// --- STANDARD LIST VIEW ---
const StandardListView: React.FC<{ 
    exercises: Exercise[], 
    timerStyle: TimerStyle,
    forceFullHeight?: boolean,
    isHyrox?: boolean
}> = ({ exercises, timerStyle, forceFullHeight = true, isHyrox = false }) => {
    const count = exercises.length;
    const isLargeList = count > 12 || isHyrox; 
    
    const repsSize = isLargeList ? 'text-lg md:text-xl' : 'text-3xl md:text-4xl';
    const padding = isHyrox ? 'pl-16 pr-6 py-2' : isLargeList ? 'pl-8 pr-4 py-2' : count > 8 ? 'pl-8 pr-6 py-3' : 'px-8 py-6';
    const gap = isLargeList ? 'gap-1' : 'gap-3';

    return (
        <div className={`w-full h-full flex flex-col ${gap} overflow-hidden pb-1`}>
            {exercises.map((ex) => {
                // Dynamisk textstorlek baserat på namnlängd
                const nameLen = ex.name.length;
                let titleSize = isLargeList ? 'text-lg sm:text-xl md:text-2xl' : count > 8 ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl';
                
                // Krymp texten om den är lång för att undvika overflow
                if (nameLen > 25) {
                    titleSize = isLargeList ? 'text-base sm:text-lg md:text-xl' : count > 8 ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl';
                }

                return (
                    <div 
                        key={ex.id} 
                        className={`flex-1 min-h-0 bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl flex flex-col justify-center border-l-[12px] shadow-sm transition-all relative group border-gray-100 dark:border-transparent ${padding}`}
                        style={{ 
                            borderLeftColor: isHyrox ? '#6366f1' : `rgb(${timerStyle.pulseRgb})`
                        }}
                    >
                        <div className="flex items-center w-full gap-6">
                            {ex.reps && (
                                <span className={`font-mono font-black text-primary bg-primary/5 px-4 py-1.5 rounded-xl whitespace-nowrap border border-primary/10 shrink-0 ${repsSize}`}>
                                    {formatReps(ex.reps)}
                                </span>
                            )}
                            <h4 className={`font-black text-gray-900 dark:text-white leading-tight tracking-tight overflow-visible whitespace-normal transition-all duration-300 ${titleSize}`}>
                                {ex.name}
                            </h4>
                        </div>

                        {ex.description && !isHyrox && count <= 8 && (
                            <div className="mt-2 hidden sm:block pl-2">
                                <p className={`font-medium text-gray-600 dark:text-gray-300 leading-snug text-lg md:text-xl line-clamp-3`}>
                                    {ex.description}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

interface BigIndicatorProps {
    currentRound: number;
    totalRounds: number;
    mode: TimerMode;
    currentInterval?: number;
    totalIntervalsInLap?: number;
}

const BigRoundIndicator: React.FC<BigIndicatorProps> = ({ currentRound, totalRounds, mode, currentInterval, totalIntervalsInLap }) => {
    if (mode !== TimerMode.Interval || mode !== TimerMode.Tabata || mode !== TimerMode.EMOM) return null;

    const showInterval = currentInterval !== undefined && totalIntervalsInLap !== undefined && mode !== TimerMode.EMOM;

    return (
        <div className="flex flex-col items-end gap-3 animate-fade-in">
            {showInterval && (
                <div className="bg-black/40 backdrop-blur-xl rounded-[2.5rem] px-10 py-6 shadow-2xl flex flex-col items-center min-w-[200px]">
                    <span className="block text-white/40 font-black text-xs sm:text-sm uppercase tracking-[0.4em] mb-2">INTERVALL</span>
                    <div className="flex items-baseline justify-center gap-1">
                        <motion.span 
                            key={`interval-${currentInterval}`} 
                            initial={{ opacity: 0, scale: 0.8 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="font-black text-6xl sm:text-7xl text-white drop-shadow-2xl leading-none"
                        >
                            {currentInterval}
                        </motion.span>
                        <span className="text-2xl sm:text-3xl font-black text-white/40">/ {totalIntervalsInLap}</span>
                    </div>
                </div>
            )}

            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-xl rounded-full px-6 py-3 shadow-xl flex items-center justify-center gap-3 min-w-[140px]"
            >
                <span className="text-white/40 font-black text-[10px] uppercase tracking-[0.3em]">
                    {mode === TimerMode.EMOM ? 'MINUT' : 'VARV'}
                </span>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{currentRound}</span>
                    <span className="text-sm font-bold text-white/40">/ {totalRounds}</span>
                </div>
            </motion.div>
        </div>
    );
};


interface TimerScreenProps {
    block: WorkoutBlock;
    onFinish: (finishData: { isNatural?: boolean; time?: number, raceId?: string }) => void;
    onHeaderVisibilityChange: (isVisible: boolean) => void;
    onShowImage: (url: string) => void; 
    setCompletionInfo: React.Dispatch<React.SetStateAction<{ workout: Workout; isFinal: boolean; blockTag?: string; finishTime?: number; } | null>>;
    setIsRegisteringHyroxTime: React.Dispatch<React.SetStateAction<boolean>>;
    setIsBackButtonHidden: React.Dispatch<React.SetStateAction<boolean>>;
    followMeShowImage: boolean;
    organization: Organization | null;
    onBackToGroups: () => void;
    isAutoTransition?: boolean;
}

interface FinishData { time: number; placement: number | null; }

export const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    setCompletionInfo, setIsRegisteringHyroxTime,
    setIsBackButtonHidden, followMeShowImage, organization, onBackToGroups,
    isAutoTransition = false
}) => {
  const { activeWorkout } = useWorkout();
  const { 
    status, currentTime, currentPhaseDuration, currentRound, currentExercise, nextExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises,
    totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, effectiveIntervalsPerLap
  } = useWorkoutTimer(block);
  
  const [controlsVisible, setControlsVisible] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);

  // --- TRANSITION LOGIC ---
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTimeLeft, setTransitionTimeLeft] = useState(0);
  const [isTransitionPaused, setIsTransitionPaused] = useState(false);
  const transitionIntervalRef = useRef<number | null>(null);
  const hasTriggeredFinish = useRef(false);

  const upcomingBlocks = useMemo(() => {
    if (!activeWorkout) return [];
    const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
    if (index === -1) return [];
    // Hämta 3 block framåt för att säkra split-vyn i transition
    return activeWorkout.blocks.slice(index + 1, index + 4);
  }, [activeWorkout, block.id]);

  const nextBlock = upcomingBlocks[0] || null;

  const workoutChain = useMemo(() => {
      if (!activeWorkout) return [block];
      const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
      if (index === -1) return [block];

      let startIdx = index;
      while (startIdx > 0 && activeWorkout.blocks[startIdx - 1].autoAdvance) {
          startIdx--;
      }

      let endIdx = index;
      while (endIdx < activeWorkout.blocks.length - 1 && activeWorkout.blocks[endIdx].autoAdvance) {
          endIdx++;
      }

      return activeWorkout.blocks.slice(startIdx, endIdx + 1);
  }, [activeWorkout, block.id]);

  const chainInfo = useMemo(() => {
      let totalDuration = 0;
      let elapsedTimeBeforeCurrent = 0;
      const currentIdxInChain = workoutChain.findIndex(b => b.id === block.id);
      
      workoutChain.forEach((b, i) => {
          const bDur = calculateBlockDuration(b.settings, b.exercises.length);
          const transTime = (i < workoutChain.length - 1 && b.autoAdvance) ? (b.transitionTime || 0) : 0;
          totalDuration += bDur + transTime;
          if (i < currentIdxInChain) elapsedTimeBeforeCurrent += bDur + transTime;
      });

      return { totalDuration, elapsedTimeBeforeCurrent, currentBlockInChain: currentIdxInChain + 1, totalBlocksInChain: workoutChain.length };
  }, [workoutChain, block.id]);

  const totalChainElapsed = useMemo(() => {
      let base = chainInfo.elapsedTimeBeforeCurrent + totalTimeElapsed;
      if (isTransitioning) {
          const elapsedInTrans = (block.transitionTime || 0) - transitionTimeLeft;
          base += elapsedInTrans;
      }
      return base;
  }, [chainInfo, totalTimeElapsed, isTransitioning, transitionTimeLeft, block.transitionTime]);

  const handleStartNextBlock = useCallback(() => {
      if (hasTriggeredFinish.current) return;
      
      if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current);
      setIsTransitioning(false);
      setIsTransitionPaused(false);
      
      if (nextBlock) {
          hasTriggeredFinish.current = true;
          onFinish({ isNatural: true, time: totalTimeElapsed }); 
      }
  }, [nextBlock, totalTimeElapsed, onFinish]);

  useEffect(() => {
      hasTriggeredFinish.current = false;
  }, []);

  useEffect(() => {
      if (status === TimerStatus.Finished && totalTimeElapsed > 0 && nextBlock && block.autoAdvance && !hasTriggeredFinish.current) {
          const waitTime = block.transitionTime || 0;
          if (waitTime === 0) {
              handleStartNextBlock();
          } else {
              setIsTransitioning(true);
              setTransitionTimeLeft(waitTime);
          }
      }
  }, [status, totalTimeElapsed, nextBlock, block.autoAdvance, block.transitionTime, handleStartNextBlock]);

  useEffect(() => {
      if (isTransitioning && !isTransitionPaused) {
          transitionIntervalRef.current = window.setInterval(() => {
              setTransitionTimeLeft(prev => {
                  if (prev <= 1) {
                      handleStartNextBlock();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      } else {
          if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current);
      }
      return () => { if (transitionIntervalRef.current) clearInterval(transitionIntervalRef.current); };
  }, [isTransitioning, isTransitionPaused, handleStartNextBlock]);

  // --- PRE-START LOGIC ---
  const hasStartedRef = useRef(false);
  
  useEffect(() => {
    if (!hasStartedRef.current && (status === TimerStatus.Idle || status === TimerStatus.Finished)) {
        if (organization) updateOrganizationActivity(organization.id);
        start({ skipPrep: isAutoTransition });
        hasStartedRef.current = true;
        onHeaderVisibilityChange(false);
        setIsBackButtonHidden(true);
    }
  }, [start, status, onHeaderVisibilityChange, setIsBackButtonHidden, organization, isAutoTransition]);

  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, FinishData>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showBackToPrepConfirmation, setShowBackToPrepConfirmation] = useState(false);
  const [showFinishAnimation, setShowFinishAnimation] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [isSavingRace, setIsSavingRace] = useState(false);
  const [finalRaceId, setFinalRaceId] = useState<string | null>(null);
  const [isClockFrozen, setIsClockFrozen] = useState(false);
  const [frozenTime, setFrozenTime] = useState(0);

  // Hyrox and Mode setup
  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.startsWith('custom-race'), [activeWorkout]);
  const isFreestanding = block.tag === 'Fristående';
  const showFullScreenColor = isFreestanding;

  const [startGroups, setStartGroups] = useState<StartGroup[]>([]);
  const startIntervalSeconds = useMemo(() => (activeWorkout?.startIntervalMinutes ?? 2) * 60, [activeWorkout]);

  const nextGroupToStartIndex = useMemo(() => startGroups.findIndex(g => g.startTime === undefined), [startGroups]);
  const nextGroupToStart = useMemo(() => (nextGroupToStartIndex !== -1 ? startGroups[nextGroupToStartIndex] : null), [startGroups, nextGroupToStartIndex]);
  const remainingGroupsCount = useMemo(() => startGroups.filter(g => g.startTime === undefined).length, [startGroups]);

  const groupForCountdownDisplay = useMemo(() => {
    if (!isHyroxRace) return null;
    if (status === TimerStatus.Preparing) return startGroups.length > 0 ? startGroups[0] : null;
    return nextGroupToStart;
  }, [isHyroxRace, status, startGroups, nextGroupToStart]);

  const timeForCountdownDisplay = useMemo(() => {
      if (!groupForCountdownDisplay) return 0;
      if (status === TimerStatus.Preparing) return currentTime;
      const groupIndex = startGroups.findIndex(g => g.id === groupForCountdownDisplay.id);
      if (groupIndex === -1) return 0;
      return (groupIndex * startIntervalSeconds) - totalTimeElapsed;
  }, [status, currentTime, groupForCountdownDisplay, startGroups, startIntervalSeconds, totalTimeElapsed]);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = wakeLock;
        wakeLock.addEventListener('release', () => { wakeLockRef.current = null; });
      } catch (err: any) { console.error(`${err.name}, ${err.message}`); }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting) requestWakeLock();
    else releaseWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible' && (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting)) requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange); releaseWakeLock(); };
  }, [status, requestWakeLock, releaseWakeLock]);

  const stopAllAudio = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    stopAllAudio();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'sv-SE'; 
    utterance.rate = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const swedishVoice = voices.find(v => v.lang === 'sv-SE' || v.lang === 'sv_SE');
    if (swedishVoice) utterance.voice = swedishVoice;
    window.speechSynthesis.speak(utterance);
  }, [stopAllAudio]);

  useEffect(() => {
    if (!isHyroxRace || !groupForCountdownDisplay || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
    const timeLeft = timeForCountdownDisplay;
    if (timeLeft === 60) speak(`${groupForCountdownDisplay.name} startar om en minut`);
    else if (timeLeft === 30) speak("30 sekunder till start");
    else if (timeLeft === 10) speak("10 sekunder");
    else if (timeLeft <= 5 && timeLeft > 0) speak(String(timeLeft)); 
    else if (timeLeft === 0) speak(`Kör ${groupForCountdownDisplay.name}!`); 
  }, [timeForCountdownDisplay, groupForCountdownDisplay, speak, isHyroxRace, status]);

  const hasCalledFinishRef = useRef(false);
  useEffect(() => {
    if (status === TimerStatus.Finished && !isHyroxRace && block.settings.mode !== TimerMode.Stopwatch && !block.autoAdvance) {
        if (hasCalledFinishRef.current) return;
        const timerId = setTimeout(() => { onFinish({ isNatural: true, time: totalTimeElapsed }); hasCalledFinishRef.current = true; }, 500);
        return () => clearTimeout(timerId);
    } else if (status !== TimerStatus.Finished) { hasCalledFinishRef.current = false; }
  }, [status, isHyroxRace, block.settings.mode, block.autoAdvance, onFinish, totalTimeElapsed]);

  const handleConfirmReset = () => {
    setShowResetConfirmation(false);
    stopAllAudio();
    setFinishedParticipants({});
    setIsClockFrozen(false);
    setFrozenTime(0);
    setIsTransitioning(false);
    setIsTransitionPaused(false);
    if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
        setStartGroups(activeWorkout.startGroups.map(g => ({ ...g, startTime: undefined })));
    } else if (activeWorkout) {
        setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout?.participants || []).join('\n'), startTime: undefined }]);
    } else {
        setStartGroups([]);
    }
    start();
  };

  useEffect(() => { return () => stopAllAudio(); }, [stopAllAudio]);

  useEffect(() => {
    if (isHyroxRace) {
        if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
            setStartGroups(activeWorkout.startGroups.map((g, index) => ({ ...g, startTime: index === 0 ? 0 : undefined })));
        } else if (activeWorkout) { 
            setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout.participants || []).join('\n'), startTime: 0 }]);
        } else { setStartGroups([]); }
    } else { setStartGroups([]); }
  }, [isHyroxRace, activeWorkout]);

  useEffect(() => {
      if (!isHyroxRace || (status !== TimerStatus.Running && status !== TimerStatus.Preparing)) return;
      const groupsToStart = startGroups.filter((group, index) => { const expectedStartTime = index * startIntervalSeconds; return group.startTime === undefined && totalTimeElapsed >= expectedStartTime; });
      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) { newGroups[index] = { ...newGroups[index], startTime: index * startIntervalSeconds }; }
              });
              return newGroups;
          });
      }
  }, [isHyroxRace, totalTimeElapsed, startGroups, status, startIntervalSeconds]);

  useEffect(() => {
      if (status === TimerStatus.Preparing) return;
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) playShortBeep();
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);

  // --- HYROX HANDLERS ---
  const startedParticipants = useMemo(() => 
    startGroups.filter(g => g.startTime !== undefined).flatMap(g => g.participants.split('\n').map(p => p.trim()).filter(Boolean)),
    [startGroups]
  );

  const handleParticipantFinish = (name: string) => {
    setSavingParticipant(name);
    const group = startGroups.find(g => g.participants.includes(name));
    if (group?.startTime !== undefined) {
      const netTime = Math.max(0, totalTimeElapsed - group.startTime);
      setFinishedParticipants(prev => ({
        ...prev,
        [name]: { time: netTime, placement: Object.keys(prev).length + 1 }
      }));
      speak(`Målgång ${name}!`);
    }
    setSavingParticipant(null);
  };

  const handleEditParticipant = (name: string) => {
    setParticipantToEdit(name);
  };

  const handleUpdateResult = (newTime: number) => {
    if (participantToEdit) {
      setFinishedParticipants(prev => ({
        ...prev,
        [participantToEdit]: { ...prev[participantToEdit], time: newTime }
      }));
      setParticipantToEdit(null);
    }
  };

  const handleAddPenalty = () => {
    if (participantToEdit) {
      setFinishedParticipants(prev => ({
        ...prev,
        [participantToEdit]: { ...prev[participantToEdit], time: prev[participantToEdit].time + 60 }
      }));
      setParticipantToEdit(null);
    }
  };

  const handleRemoveResult = () => {
    if (participantToEdit) {
      setFinishedParticipants(prev => {
        const next = { ...prev };
        delete next[participantToEdit];
        return next;
      });
      setParticipantToEdit(null);
    }
  };

  const handleRaceComplete = useCallback(async () => {
      if (!isHyroxRace || !activeWorkout || !organization) { 
          if (!organization) console.error("Hyrox save failed: Missing organizationId");
          return; 
      }
      
      setIsSavingRace(true);
      const sortedFinishers = Object.entries(finishedParticipants).sort(([, a], [, b]) => (a as FinishData).time - (b as FinishData).time);
      const winner = sortedFinishers.length > 0 ? sortedFinishers[0][0] : null;
      setWinnerName(winner);
      
      const raceResults = sortedFinishers.map(([participant, data], index) => {
          const group = startGroups.find(g => g.participants.includes(participant));
          return { participant, time: data.time, groupId: group?.id || 'unknown' };
      });

      try {
          const raceData: Omit<HyroxRace, 'id' | 'createdAt' | 'organizationId'> = {
              raceName: activeWorkout.title,
              exercises: block.exercises.map(e => `${e.reps || ''} ${e.name}`.trim()),
              startGroups: startGroups.map(g => ({ id: g.id, name: g.name, participants: g.participants.split('\n').map(p => p.trim()).filter(Boolean) })),
              results: raceResults
          };
          
          const savedRace = await saveRace(raceData, organization.id);
          if (savedRace && savedRace.id) {
              setFinalRaceId(savedRace.id);
              setShowFinishAnimation(true);
              if (winner) speak(`Och vinnaren är ${winner}! Bra jobbat alla!`);
          } else {
              throw new Error("Missing raceId from server response");
          }
      } catch (error) {
          console.error("Failed to save race:", error);
          alert("Kunde inte spara loppet. Kontrollera din anslutning.");
      } finally {
          setIsSavingRace(false);
      }
  }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, speak]);

  const timerStyle = getTimerStyle(status, block.settings.mode, isHyroxRace, isTransitioning);
  
  const modeLabel = useMemo(() => {
      if (isTransitioning) return "VILA INFÖR NÄSTA";
      if (isHyroxRace) return "RACE";
      switch(block.settings.mode) {
          case TimerMode.Interval: return "INTERVALLER";
          case TimerMode.Tabata: return "TABATA";
          case TimerMode.AMRAP: return "AMRAP";
          case TimerMode.EMOM: return "EMOM";
          case TimerMode.TimeCap: return "TIME CAP";
          case TimerMode.Stopwatch: return "STOPPUR";
          default: return (block.settings.mode as string).toUpperCase();
      }
  }, [block.settings.mode, isHyroxRace, isTransitioning]);

  const statusLabel = useMemo(() => {
      if (isTransitioning) return `Gör er redo för: ${nextBlock?.title}`;
      if (isHyroxRace) {
          switch (status) {
              case TimerStatus.Preparing: return "Gör er redo";
              case TimerStatus.Running: return "Pågår"; 
              case TimerStatus.Resting: return "Vila"; 
              case TimerStatus.Paused: return "Pausad";
              case TimerStatus.Finished: return "Målgång";
              default: return "Redo";
          }
      }
      switch (status) {
          case TimerStatus.Preparing: return "Gör dig redo";
          case TimerStatus.Running: return "Arbete";
          case TimerStatus.Resting: return "Vila";
          case TimerStatus.Paused: return "Pausad";
          case TimerStatus.Finished: return "Klar";
          default: return "Redo";
      }
  }, [status, isHyroxRace, isTransitioning, nextBlock]);

  const timeToDisplay = useMemo(() => {
      if (isTransitioning) return transitionTimeLeft;
      if (status === TimerStatus.Preparing) return currentTime;
      if (isHyroxRace && isClockFrozen) return frozenTime;
      if (isHyroxRace || block.settings.mode === TimerMode.Stopwatch) return totalTimeElapsed;
      if (!block.settings.direction || block.settings.direction === 'down') return currentTime;
      return currentPhaseDuration - currentTime;
  }, [status, currentTime, isHyroxRace, block.settings, currentPhaseDuration, totalTimeElapsed, isClockFrozen, frozenTime, isTransitioning, transitionTimeLeft]);

  const minutesStr = Math.floor(timeToDisplay / 60).toString().padStart(2, '0');
  const secondsStr = (timeToDisplay % 60).toString().padStart(2, '0');

  const currentIntervalInLap = (completedWorkIntervals % effectiveIntervalsPerLap) + 1;
  
  // Visa split-vyn om vi har kommande block, antingen i träning eller under transition
  const showSplitView = upcomingBlocks.length > 0 && block.autoAdvance;

  const isRestNext = block.autoAdvance && (block.transitionTime || 0) > 0 && status !== TimerStatus.Resting;

  const handleInteraction = () => { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); restartHideTimer(); };
  const restartHideTimer = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing || isTransitioning) {
        hideTimeoutRef.current = window.setTimeout(() => { setControlsVisible(false); onHeaderVisibilityChange(false); setIsBackButtonHidden(true); }, 3000); 
    }
  }, [status, isTransitioning, onHeaderVisibilityChange, setIsBackButtonHidden]);

  useEffect(() => {
    if (controlsVisible) restartHideTimer();
    return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
  }, [controlsVisible, restartHideTimer]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting || isTransitioning) restartHideTimer();
    else { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }
  }, [status, restartHideTimer, onHeaderVisibilityChange, setIsBackButtonHidden, isTransitioning]);

  const isActuallyPaused = status === TimerStatus.Paused || (isTransitioning && isTransitionPaused);
  const isActuallyFinishedOrIdle = (status === TimerStatus.Idle || status === TimerStatus.Finished) && !isTransitioning;

  return (
    <div 
        className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 ${showFullScreenColor ? `${timerStyle.bg}` : 'bg-gray-100 dark:bg-black'}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
    >
      {showConfetti && <Confetti />}
      {showFinishAnimation && (
          <RaceFinishAnimation 
            winnerName={winnerName} 
            onDismiss={() => {
                setShowFinishAnimation(false);
                if (finalRaceId) onFinish({ isNatural: true, raceId: finalRaceId });
            }} 
          />
      )}
      
      <AnimatePresence>
        {isActuallyPaused && !showFinishAnimation && (
            <PauseOverlay onResume={isTransitioning ? () => setIsTransitionPaused(false) : resume} onRestart={handleConfirmReset} onFinish={() => onFinish({ isNatural: false })} />
        )}
        {participantToEdit && (
            <EditResultModal 
                participantName={participantToEdit}
                currentTime={finishedParticipants[participantToEdit]?.time || 0}
                onSave={handleUpdateResult}
                onAddPenalty={handleAddPenalty}
                onUndo={handleRemoveResult}
                onCancel={() => setParticipantToEdit(null)}
            />
        )}
        {showResetConfirmation && <RaceResetConfirmationModal onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirmation(false)} onExit={() => onFinish({ isNatural: false })} />}
        {showBackToPrepConfirmation && <RaceBackToPrepConfirmationModal onConfirm={onBackToGroups} onCancel={() => setShowBackToPrepConfirmation(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {status !== TimerStatus.Idle && !isActuallyPaused && !showFinishAnimation && (
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute top-16 z-[100]"
                style={{ right: isHyroxRace ? `calc(${HYROX_RIGHT_PANEL_WIDTH} + 2.5rem)` : '2.5rem' }}
            >
                {!isTransitioning && (
                    <BigRoundIndicator 
                        currentRound={currentRound} 
                        totalRounds={totalRounds} 
                        mode={block.settings.mode} 
                        currentInterval={(completedWorkIntervals % (block?.settings.specifiedIntervalsPerLap || block.exercises.length || 1)) + 1}
                        totalIntervalsInLap={block?.settings.specifiedIntervalsPerLap || block.exercises.length || 1}
                    />
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN TIMER CARD */}
      <div 
          className={`absolute flex flex-col items-center transition-all duration-500 z-10 left-0 
              ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] pr-10` : 'right-0'} 
              ${showFullScreenColor 
                  ? `top-[12%] min-h-[50%] justify-center` 
                  : `pt-10 pb-10 top-4 min-h-[25%] mx-4 sm:mx-6 rounded-[3rem] shadow-2xl ${timerStyle.bg}`
              }`}
          style={!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties : undefined}
      >
        <div className="mb-4 px-8 py-2 rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-lg z-20">
            <span className={`font-black tracking-[0.3em] text-white uppercase drop-shadow-md text-lg md:text-xl`}>{modeLabel}</span>
        </div>

        {/* STATUS (ARBETE/VILA) - Överst */}
        <div className="text-center z-20 w-full px-10 mb-2">
            <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-3xl sm:text-5xl lg:text-6xl overflow-visible whitespace-nowrap leading-none`}>{statusLabel}</h2>
        </div>

        {/* SIFFROR (Tiden) - Mitten */}
        <div className="z-20 relative flex flex-col items-center w-full text-white">
            <div className="flex items-center justify-center w-full gap-2">
                 <span className="font-mono font-black leading-none tracking-tighter tabular-nums drop-shadow-2xl select-none text-[8rem] sm:text-[10rem] md:text-[12rem]">
                    {minutesStr}:{secondsStr}
                 </span>
            </div>
        </div>

        {/* TIDSLINJE (Roadmap) - Under tiden */}
        <div className="w-[80%] max-w-4xl mt-2 mb-2 z-20">
            <SegmentedRoadmap 
                chain={workoutChain} 
                currentBlockId={block.id} 
                totalChainElapsed={totalChainElapsed} 
                totalChainTime={chainInfo.totalDuration}
            />
        </div>

        {/* BLOCK RUBRIK (Stort) - Längst ner */}
        <div className="text-center z-20 w-full px-10 mt-4 mb-2">
            <h1 className="font-black text-white/90 uppercase tracking-tighter text-2xl sm:text-3xl md:text-4xl drop-shadow-lg overflow-visible whitespace-nowrap leading-none">
                {isTransitioning ? nextBlock?.title : block.title}
            </h1>
        </div>
      </div>

      {/* CONTENT AREA (Under Clock) */}
      <div className={`absolute bottom-4 left-0 flex flex-col items-center justify-start z-0 pt-2
          ${showFullScreenColor ? 'top-[65%]' : 'top-[28%]'} 
          ${isHyroxRace ? `right-[${HYROX_RIGHT_PANEL_WIDTH}] px-6` : 'right-0 px-6'}`}>
          
          <div className="w-full max-w-[1500px] h-full flex flex-col">
              <div className="flex flex-col h-full w-full">
                <AnimatePresence>
                    {isHyroxRace && groupForCountdownDisplay && (
                        <div className="flex-shrink-0 w-full max-w-4xl mx-auto mb-2">
                            <NextStartIndicator
                                groupName={groupForCountdownDisplay.name}
                                timeLeft={timeForCountdownDisplay}
                                groupsLeft={remainingGroupsCount}
                            />
                        </div>
                    )}
                </AnimatePresence>

                {block.followMe && !isTransitioning ? (
                    // FOLLOW ME LAYOUT (Vertical stack - Bar forced to bottom)
                    <div className="w-full flex flex-col items-center flex-grow justify-between pb-4 min-h-0">
                        <div className="w-full flex flex-col flex-grow min-h-0">
                            {block.showDescriptionInTimer && block.setupDescription && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-8 py-6 mb-6 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 w-full flex items-center gap-6 shadow-xl rounded-[2.5rem] flex-shrink-0 mx-auto max-w-5xl">
                                        <div className="bg-primary/10 p-3 rounded-2xl"><InformationCircleIcon className="w-8 h-8 text-primary shrink-0" /></div>
                                        <p className="text-gray-900 dark:text-white text-2xl md:text-3xl font-black leading-tight tracking-tight">{block.setupDescription}</p>
                                </motion.div>
                            )}
                            <div className="flex-grow min-h-0">
                                <FollowMeView 
                                    exercise={currentExercise} 
                                    nextExercise={nextExercise} 
                                    timerStyle={timerStyle} 
                                    status={status} 
                                    nextBlock={nextBlock && block.autoAdvance ? nextBlock : undefined}
                                    isRestNext={isRestNext}
                                    transitionTime={isRestNext ? block.transitionTime : undefined}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    // STANDARD LIST LAYOUT (Side by side if next blocks exist)
                    <div className="flex gap-4 flex-grow items-stretch w-full min-h-0">
                         <div className={`flex flex-col gap-6 transition-all duration-500 h-full min-h-0 ${showSplitView ? 'w-2/3' : 'w-full mx-auto max-w-6xl'}`}>
                            {isTransitioning ? (
                                // Header för vila-läget
                                <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center bg-white/80 dark:bg-black/20 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-lg gap-6">
                                    <div>
                                        <span className="inline-block px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-black uppercase tracking-[0.2em] mb-3">Uppladdning</span>
                                        <h3 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{nextBlock?.title}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Gör er redo för nästa del av passet</p>
                                    </div>
                                    <button 
                                        onClick={handleStartNextBlock}
                                        className="bg-gray-900 dark:bg-white text-white dark:text-black font-black py-4 px-10 rounded-2xl shadow-2xl hover:scale-105 transition-all text-lg uppercase tracking-widest border-4 border-gray-700 dark:border-white/30"
                                    >
                                        Starta nu
                                    </button>
                                </div>
                            ) : (
                                block.showDescriptionInTimer && block.setupDescription && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-8 py-6 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 w-full flex items-center gap-6 shadow-xl rounded-[2.5rem] flex-shrink-0">
                                            <div className="bg-primary/10 p-3 rounded-2xl"><InformationCircleIcon className="w-8 h-8 text-primary shrink-0" /></div>
                                            <p className="text-gray-900 dark:text-white text-2xl md:text-3xl font-black leading-tight tracking-tight">{block.setupDescription}</p>
                                    </motion.div>
                                )
                            )}

                            <div className="w-full flex-grow min-h-0"> 
                                {!isFreestanding && (
                                    <StandardListView 
                                        exercises={isTransitioning ? nextBlock!.exercises : block.exercises} 
                                        timerStyle={timerStyle} 
                                        isHyrox={isHyroxRace} 
                                    />
                                )}
                            </div>
                        </div>

                        {/* UPCOMING BLOCKS STACK (33% width) */}
                        {showSplitView ? (
                            <div className="w-1/3 h-full flex flex-col gap-4 pb-1">
                                {isTransitioning ? (
                                    // Under vila: Visa kommande block C och D i sidobaren
                                    <>
                                        {upcomingBlocks[1] && <NextBlockPreview block={upcomingBlocks[1]} label="HÄRNÄST" flexClassName="flex-1" />}
                                        {upcomingBlocks[2] && <NextBlockPreview block={upcomingBlocks[2]} label="DÄREFTER" flexClassName="flex-1" />}
                                    </>
                                ) : isRestNext ? (
                                    // Under träning med vila efter: Visa vila och Block B
                                    <>
                                        <NextRestPreview 
                                            transitionTime={block.transitionTime || 0} 
                                            isCompact={!!upcomingBlocks[0]}
                                        />
                                        {upcomingBlocks[0] && (
                                            <NextBlockPreview 
                                                block={upcomingBlocks[0]} 
                                                label="DÄREFTER" 
                                                flexClassName="flex-1"
                                            />
                                        )}
                                    </>
                                ) : (
                                    // Under träning utan vila: Visa Block B och C
                                    <>
                                        <NextBlockPreview block={nextBlock!} label="HÄRNÄST" flexClassName="flex-1" />
                                        {upcomingBlocks[1] && (
                                            <NextBlockPreview 
                                                block={upcomingBlocks[1]} 
                                                label="DÄREFTER" 
                                                flexClassName="flex-1"
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}
              </div>
          </div>
      </div>

      {isHyroxRace && (
          <div 
              className="absolute top-0 right-0 bottom-0 border-l-4 border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md flex flex-col z-40 shadow-2xl"
              style={{ width: HYROX_RIGHT_PANEL_WIDTH }}
          >
              <ParticipantFinishList 
                participants={startedParticipants} 
                finishData={finishedParticipants} 
                onFinish={handleParticipantFinish} 
                onEdit={handleEditParticipant} 
                isSaving={(name) => savingParticipant === name} 
              />
              
              <div className="p-6 mt-auto bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/10">
                 <button 
                    onClick={handleRaceComplete}
                    disabled={isSavingRace || startedParticipants.length === 0}
                    className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-tight disabled:opacity-50 ${isClockFrozen ? 'bg-green-600 hover:bg-green-500 shadow-green-500/20 text-white' : 'bg-primary hover:brightness-110 shadow-primary/20 text-white'}`}
                 >
                    {isSavingRace ? (
                        <>
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Sparar...</span>
                        </>
                    ) : (
                        <>
                            <span>{isClockFrozen ? 'Slutför & Spara lopp' : 'Avsluta lopp i förtid'}</span>
                        </>
                    )}
                 </button>
              </div>
          </div>
      )}

      <div className={`fixed z-50 transition-all duration-500 flex gap-6 left-1/2 -translate-x-1/2 ${showFullScreenColor ? 'top-[65%]' : 'top-[35%]'} ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'} ${isHyroxRace ? 'ml-[-225px]' : ''}`}>
            {isActuallyFinishedOrIdle ? (
                <>
                    <button onClick={() => onFinish({ isNatural: false })} className="bg-gray-600/80 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-gray-500 transition-colors text-xl backdrop-blur-md border-2 border-white/20 uppercase">TILLBAKA</button>
                    <button onClick={() => start()} className="bg-white text-black font-black py-4 px-16 rounded-full shadow-2xl hover:scale-105 transition-transform text-xl border-4 border-white/50 uppercase">STARTA</button>
                </>
            ) : isActuallyPaused ? (
                <button onClick={isTransitioning ? () => setIsTransitionPaused(false) : resume} className="bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-xl border-2 border-green-400 uppercase">FORTSÄTT</button>
            ) : (
                <button onClick={isTransitioning ? () => setIsTransitionPaused(true) : pause} className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl hover:bg-gray-100 transition-transform hover:scale-105 text-xl border-4 border-white/50 uppercase">PAUSA</button>
            )}
            {isHyroxRace && status !== TimerStatus.Running && <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-4 px-8 rounded-full shadow-xl border-2 border-gray-600 hover:bg-gray-700 transition-colors text-lg uppercase">⚙️ Grupper</button>}
      </div>
    </div>
  );
};

export default TimerScreen;