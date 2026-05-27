
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutBlock, TimerStatus, TimerMode, Exercise, StartGroup, Organization, HyroxRace, Workout, TimerSegment } from '../types';
import { useWorkoutTimer, playShortBeep, getAudioContext, calculateBlockDuration, playTimerSound } from '../hooks/useWorkoutTimer';
import { useWorkout } from '../context/WorkoutContext';
import { saveRace, updateOrganizationActivity, updateStudioRemoteState } from '../services/firebaseService';
import QRCode from 'react-qr-code';
import { Confetti } from './WorkoutCompleteModal';
import { EditResultModal, RaceResetConfirmationModal, RaceBackToPrepConfirmationModal, RaceFinishAnimation, PauseOverlay } from './timer/TimerModals';
import { ParticipantFinishList } from './timer/ParticipantFinishList';
import { DumbbellIcon, InformationCircleIcon, LightningIcon, SparklesIcon, ChevronRightIcon, ClockIcon, PlayIcon, SettingsIcon, RefreshIcon } from './icons'; // Added SettingsIcon if available, else standard icons
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';

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

const getTimerStyle = (status: TimerStatus, mode: TimerMode, isHyrox: boolean, isTransitioning: boolean, currentSegment: TimerSegment | null): TimerStyle => {
  if (isTransitioning) {
      return { bg: 'bg-teal-500', text: 'text-white', pulseRgb: '45, 212, 191', border: 'border-teal-200', badge: 'bg-teal-600' };
  }
  
  if (isHyrox) {
      return { bg: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 animate-pulse-hyrox-bg', text: 'text-white', pulseRgb: '255, 255, 255', border: 'border-white', badge: 'bg-white text-indigo-600' };
  }

  // CUSTOM MODE OVERRIDE
  if (mode === TimerMode.Custom && currentSegment) {
      if (currentSegment.type === 'work') {
          return { bg: 'bg-orange-600', text: 'text-white', pulseRgb: '249, 115, 22', border: 'border-orange-300', badge: 'bg-orange-600' };
      } else {
          return { bg: 'bg-teal-500', text: 'text-white', pulseRgb: '45, 212, 191', border: 'border-teal-200', badge: 'bg-teal-600' };
      }
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
      // IDLE STATE - Use a neutral but ready color
      return { bg: 'bg-slate-800', text: 'text-white', pulseRgb: '30, 41, 59', border: 'border-slate-600', badge: 'bg-slate-700' };
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
    return reps.trim();
};

const formatSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getBlockTimeLabel = (block: WorkoutBlock): string => {
    const s = block.settings;
    if (!s) return "";
    
    if (s.mode === TimerMode.NoTimer) return "Ingen tid";
    
    const duration = calculateBlockDuration(s, block.exercises?.length || 0);
    return formatSeconds(duration);
};

// --- Visualization Components ---

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

const SegmentedRoadmap: React.FC<{ 
    chain: WorkoutBlock[]; 
    currentBlockId: string; 
    totalChainElapsed: number; 
    totalChainTime: number;
    // Props for Custom Mode Roadmap
    isCustomMode?: boolean;
    sequence?: TimerSegment[];
    currentSegmentIndex?: number;
    totalSequenceDuration?: number;
    totalSequenceElapsed?: number;
}> = ({ chain, currentBlockId, totalChainElapsed, totalChainTime, isCustomMode, sequence, currentSegmentIndex, totalSequenceDuration, totalSequenceElapsed }) => {
    
    // STANDARD BLOCK CHAIN ROADMAP
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
                        <span className="block text-[8px] font-black text-gray-400 dark:text-white/30 uppercase tracking-widest mb-0.5">NÄSTA START</span>
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
    isRestNext?: boolean,
    showDescription: boolean,
    textSizeScale?: number, // NEW PROP
    repsSizeScale?: number,  // NEW PROP
    upcomingText?: string | null
}> = ({ exercise, nextExercise, timerStyle, status, nextBlock, transitionTime, isRestNext, showDescription, textSizeScale = 1, repsSizeScale = 1, upcomingText }) => {
    const isResting = status === TimerStatus.Resting;
    const isPreparing = status === TimerStatus.Preparing;
    // IF IDLE (Lobby), show the first exercise as "Next/Ready"
    const isIdle = status === TimerStatus.Idle;

    const displayExercise = exercise;
    let label = "Aktuell övning";
    if (isResting || isPreparing) label = "Nästa övning";
    if (isIdle) label = "Första övning";

    if (!displayExercise) return null;

    // Dynamisk storlek för övningsnamnet baserat på teckenantal + SKALNING
    const nameLen = displayExercise.name.length;
    
    // Base sizes in REM (approximate to previous Tailwind classes)
    // text-8xl = 6rem, text-7xl = 4.5rem, text-6xl = 3.75rem
    let baseTitleRem = 6; 
    if (nameLen > 35) baseTitleRem = 3.75;
    else if (nameLen > 20) baseTitleRem = 4.5;

    const calculatedTitleSize = `${baseTitleRem * textSizeScale}rem`;
    const calculatedRepsSize = `${4.5 * repsSizeScale}rem`; // Base 4.5rem (~text-7xl)

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
                        <span className="block text-2xl md:text-3xl font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-4">
                            {label}
                        </span>
                        <h3 
                            className="font-black text-gray-900 dark:text-white leading-tight mb-6 tracking-tight transition-all duration-300"
                            style={{ fontSize: calculatedTitleSize }}
                        >
                            {displayExercise.name}
                        </h3>
                        {displayExercise.reps && (
                            <p 
                                className="font-black text-primary mb-6 transition-all duration-300"
                                style={{ fontSize: calculatedRepsSize }}
                            >
                                {formatReps(displayExercise.reps)}
                            </p>
                        )}
                        {displayExercise.description && showDescription && (
                            <p className="text-gray-600 dark:text-gray-300 text-2xl md:text-4xl leading-relaxed max-w-4xl font-medium">
                                {displayExercise.description}
                            </p>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
            
            <AnimatePresence>
                {upcomingText && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mt-8 bg-white px-10 py-5 rounded-3xl shadow-2xl flex items-center gap-4"
                    >
                        <span className="text-gray-500 font-bold uppercase tracking-widest text-2xl md:text-3xl">Nästa:</span>
                        <span className="text-gray-900 font-black uppercase tracking-tight text-5xl md:text-6xl">
                            {upcomingText}
                        </span>
                    </motion.div>
                )}
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
    isHyrox?: boolean,
    showDescriptions: boolean,
    textSizeScale?: number, // NEW PROP
    repsSizeScale?: number,  // NEW PROP
    status: TimerStatus // NEW PROP
}> = ({ exercises, timerStyle, forceFullHeight = true, isHyrox = false, showDescriptions, textSizeScale = 1, repsSizeScale = 1, status }) => {
    const count = exercises.length;
    const isLargeList = count > 12 || isHyrox; 
    
    // --- NY LOGIK FÖR STORLEKAR (REM-baserad + Skalning) ---
    // Vi definierar en "Bas" för Standardläget och multiplicerar med skalningen.
    
    // Standardstorlekar i REM
    const titleBaseRem = isHyrox ? 1.5 : 2.25; // ~text-2xl / text-4xl
    const repsBaseRem = isHyrox ? 1.25 : 3;    // ~text-xl / text-5xl

    const calculatedTitleSize = `${titleBaseRem * textSizeScale}rem`;
    const calculatedRepsSize = `${repsBaseRem * repsSizeScale}rem`;

    // Padding logic (behåller standard-Tailwind för enkelhet, men kan skalas om man vill)
    const padding = isHyrox ? 'pl-16 pr-6 py-2' : isLargeList ? 'pl-8 pr-4 py-2' : count > 6 ? 'pl-8 pr-6 py-3' : 'px-10 py-4';

    return (
        <div className={`w-full h-full flex flex-col overflow-hidden pb-1`}>
            {exercises.map((ex, i) => {
                const useGroupColor = !!ex.groupColor;
                const nextEx = exercises[i + 1];
                const isGroupedWithNext = nextEx && ex.groupId && ex.groupId === nextEx.groupId;
                
                let mbClass = '';
                if (i < exercises.length - 1) {
                    if (isGroupedWithNext) {
                        mbClass = isLargeList ? 'mb-0' : 'mb-1'; // Reduced gap for grouped items
                    } else {
                        mbClass = isLargeList ? 'mb-1' : count > 6 ? 'mb-2' : 'mb-4';
                    }
                }
                
                return (
                    <div 
                        key={ex.id} 
                        className={`flex-1 min-h-0 bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl flex flex-col justify-center border-l-[12px] shadow-sm transition-all relative group ${
                            useGroupColor 
                            ? ex.groupColor.replace('bg-', 'border-') 
                            : 'border-gray-100 dark:border-transparent'
                        } ${padding} ${mbClass}`}
                        style={{ 
                            borderLeftColor: useGroupColor ? undefined : (isHyrox ? '#6366f1' : `rgb(${timerStyle.pulseRgb})`)
                        }}
                    >
                        <div className="flex items-center w-full gap-6 md:gap-8">
                            {ex.reps && (
                                <div className="shrink-0 flex items-center justify-center bg-primary/5 rounded-2xl border border-primary/10 px-4 py-2 min-w-[80px] md:min-w-[120px]">
                                    <span 
                                        className={`font-mono font-black text-primary whitespace-nowrap leading-none`}
                                        style={{ fontSize: calculatedRepsSize }}
                                    >
                                        {formatReps(ex.reps)}
                                    </span>
                                </div>
                            )}
                            <h4 
                                className={`font-black text-gray-900 dark:text-white leading-[0.9] tracking-tight overflow-visible whitespace-normal transition-all duration-300`}
                                style={{ fontSize: calculatedTitleSize }}
                            >
                                {ex.name}
                            </h4>
                        </div>

                        {ex.description && showDescriptions && !isHyrox && count <= 8 && (
                            <div className="mt-3 hidden sm:block pl-1">
                                <p className={`font-medium text-gray-600 dark:text-gray-300 leading-snug line-clamp-2`} style={{ fontSize: `calc(${calculatedTitleSize} * 0.6)` }}>
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
    if (mode !== TimerMode.Interval && mode !== TimerMode.Tabata && mode !== TimerMode.EMOM && mode !== TimerMode.Custom) return null;

    let primaryLabel = '';
    let primaryCurrent = 0;
    let primaryTotal = 0;

    let secondaryLabel = '';
    let secondaryCurrent = 0;
    let secondaryTotal = 0;

    if (mode === TimerMode.Custom) {
        primaryLabel = 'INTERVALL';
        primaryCurrent = currentInterval || 1;
        primaryTotal = totalIntervalsInLap || 1;
        secondaryLabel = 'VARV';
        secondaryCurrent = currentRound;
        secondaryTotal = totalRounds;
    } else if (mode === TimerMode.Interval && currentInterval !== undefined && totalIntervalsInLap !== undefined) {
        primaryLabel = 'INTERVALL';
        primaryCurrent = currentInterval;
        primaryTotal = totalIntervalsInLap;
        secondaryLabel = 'VARV';
        secondaryCurrent = currentRound;
        secondaryTotal = totalRounds;
    } else if (mode === TimerMode.Interval) {
        primaryLabel = 'INTERVALL';
        primaryCurrent = currentRound;
        primaryTotal = totalRounds;
    } else if (mode === TimerMode.Tabata) {
        primaryLabel = 'INTERVALL';
        primaryCurrent = currentRound;
        primaryTotal = totalRounds;
    } else if (mode === TimerMode.EMOM) {
        primaryLabel = 'MINUT';
        primaryCurrent = currentRound;
        primaryTotal = totalRounds;
    }

    return (
        <div className="flex flex-col items-end gap-1 animate-fade-in">
            <div className="flex flex-col items-end">
                <span className="block text-white/80 font-black text-xs sm:text-sm uppercase tracking-[0.4em] mb-1 drop-shadow-md">{primaryLabel}</span>
                <div className="flex items-baseline justify-end gap-1">
                    <motion.span 
                        key={`primary-${primaryCurrent}`} 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="font-black text-6xl sm:text-7xl text-white drop-shadow-lg leading-none"
                    >
                        {primaryCurrent}
                    </motion.span>
                    <span className="text-2xl sm:text-3xl font-black text-white/80 drop-shadow-md">/ {primaryTotal}</span>
                </div>
            </div>

            {secondaryLabel && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-end gap-3 mt-2"
                >
                    <span className="text-white/80 font-black text-[10px] sm:text-xs uppercase tracking-[0.3em] drop-shadow-md">
                        {secondaryLabel}
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-white drop-shadow-lg">{secondaryCurrent}</span>
                        <span className="text-sm sm:text-base font-bold text-white/80 drop-shadow-md">/ {secondaryTotal}</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
};


// --- TIMER CONTROLS COMPONENT ---
const TimerControls: React.FC<{
    textSizeScale: number;
    repsSizeScale: number;
    onTextChange: (val: number) => void;
    onRepsChange: (val: number) => void;
    visible: boolean;
}> = ({ textSizeScale, repsSizeScale, onTextChange, onRepsChange, visible }) => {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-6 shadow-2xl overflow-hidden mx-auto max-w-2xl mt-4"
                >
                    {/* Text Size Control */}
                    <div className="flex items-center gap-4 w-full">
                        <span className="text-gray-500 dark:text-white/50 text-xs font-bold uppercase tracking-wider w-12">Text</span>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={textSizeScale}
                            onChange={(e) => onTextChange(parseFloat(e.target.value))}
                            className="flex-grow h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-gray-900 dark:text-white font-mono font-bold w-12 text-right">
                            {Math.round(textSizeScale * 100)}%
                        </span>
                    </div>

                    <div className="hidden sm:block w-px h-8 bg-gray-300 dark:bg-white/10"></div>

                    {/* Reps Size Control */}
                    <div className="flex items-center gap-4 w-full">
                        <span className="text-gray-500 dark:text-white/50 text-xs font-bold uppercase tracking-wider w-12">Reps</span>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.5" 
                            step="0.1" 
                            value={repsSizeScale}
                            onChange={(e) => onRepsChange(parseFloat(e.target.value))}
                            className="flex-grow h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-gray-900 dark:text-white font-mono font-bold w-12 text-right">
                            {Math.round(repsSizeScale * 100)}%
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
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
    remoteCommand?: { type: string, timestamp: number } | null | any;
}

interface FinishData { time: number; placement: number | null; }

export const TimerScreen: React.FC<TimerScreenProps> = ({ 
    block, onFinish, onHeaderVisibilityChange, onShowImage,
    setCompletionInfo, setIsRegisteringHyroxTime,
    setIsBackButtonHidden, followMeShowImage, organization, onBackToGroups,
    isAutoTransition = false
}) => {
  const { activeWorkout } = useWorkout();
  const { studioConfig, selectedStudio, selectedOrganization } = useStudio(); 
  const { isStudioMode } = useAuth();
  
  // Use the hook with the selected sound profile
  const { 
    status, currentTime, currentPhaseDuration, currentRound, currentExercise, nextExercise,
    start, pause, resume, reset, 
    totalRounds, totalExercises,
    totalBlockDuration, totalTimeElapsed,
    completedWorkIntervals, effectiveIntervalsPerLap,
    currentSegment, // Get current segment for Custom Mode
    nextSegment,
    totalWorkIntervals
  } = useWorkoutTimer(block, studioConfig.soundProfile || 'airhorn');

  // LOBBY MODE STATE - Default to TRUE unless auto-transition
  const [isLobbyMode, setIsLobbyMode] = useState(!isAutoTransition);

  // --- NEW STATES FOR TEXT/REPS SIZE ---
  const [textSizeScale, setTextSizeScale] = useState(1);
  const [repsSizeScale, setRepsSizeScale] = useState(1);
  
  // EXITING STATE FOR IMMEDIATE VISUAL FEEDBACK
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = () => {
      if (isExiting) return;
      setIsExiting(true);
      // Allow the UI to paint the exiting state (overlay fade out) before blocking the thread with unmount
      setTimeout(() => {
          onFinish({ isNatural: false });
      }, 100);
  };

  // Sync with Remote State
  // IMPORTANT: We need to listen to the selectedStudio from context which gets updated via the snapshot listener in App.tsx
  // The previous implementation might have been relying on a stale reference or not triggering re-renders correctly.
  
  const remoteViewerSettings = selectedStudio?.remoteState?.viewerSettings;

  useEffect(() => {
      if (remoteViewerSettings) {
          const { textScale, repsScale } = remoteViewerSettings;
          // Only update if values are different to avoid loops, though React state setter handles this.
          if (textScale !== undefined) setTextSizeScale(textScale);
          if (repsScale !== undefined) setRepsSizeScale(repsScale);
      }
  }, [remoteViewerSettings]); // Dependency on the specific object part

  useEffect(() => {
      const storedText = localStorage.getItem('timer-text-scale');
      const storedReps = localStorage.getItem('timer-reps-scale');
      // Only load from local storage if NO remote settings are present
      if (storedText && !remoteViewerSettings) setTextSizeScale(parseFloat(storedText));
      if (storedReps && !remoteViewerSettings) setRepsSizeScale(parseFloat(storedReps));
  }, [remoteViewerSettings]);

  const handleSizeChange = (type: 'text' | 'reps', val: number) => {
      if (type === 'text') {
          setTextSizeScale(val);
          localStorage.setItem('timer-text-scale', val.toString());
      } else {
          setRepsSizeScale(val);
          localStorage.setItem('timer-reps-scale', val.toString());
      }
  };

  const [controlsVisible, setControlsVisible] = React.useState(false);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  
  // Get navigation position preference (default top)
  const navPos = studioConfig.navigationControlPosition || 'top';



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
      // Om vi inte har ett aktivt pass, visa bara det aktuella blocket
      if (!activeWorkout) return [block];

      const index = activeWorkout.blocks.findIndex(b => b.id === block.id);
      
      // Om blocket inte hittas i passet (vilket kan hända precis vid ett byte), 
      // använd det aktuella blocket som bas för att undvika krasch.
      if (index === -1) return [block];

      // Hitta början på kedjan (gå bakåt så länge föregående block har autoAdvance)
      let startIdx = index;
      while (startIdx > 0 && activeWorkout.blocks[startIdx - 1].autoAdvance) {
          startIdx--;
      }

      // Hitta slutet på kedjan (gå framåt så länge nuvarande/nästa block har autoAdvance)
      let endIdx = index;
      while (endIdx < activeWorkout.blocks.length - 1 && activeWorkout.blocks[endIdx].autoAdvance) {
          endIdx++;
      }

      // Returnera den exakta delen av passet som ska köras i en följd
      return activeWorkout.blocks.slice(startIdx, endIdx + 1);
  }, [activeWorkout, block]); // <--- VIKTIGT: Här lyssnar vi på hela blocket, inte bara ID

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
      if (status === TimerStatus.Finished && nextBlock && block.autoAdvance && !hasTriggeredFinish.current) {
          const waitTime = block.transitionTime || 0;
          if (waitTime === 0) {
              handleStartNextBlock();
          } else {
              setIsTransitioning(true);
              setTransitionTimeLeft(waitTime);
          }
      }
  }, [status, nextBlock, block.autoAdvance, block.transitionTime, handleStartNextBlock]);

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
        
        // IMPORTANT: Only auto-start if NOT in lobby mode
        if (!isLobbyMode) {
             start({ skipPrep: isAutoTransition });
        }
        
        hasStartedRef.current = true;
        if (!isLobbyMode) {
             onHeaderVisibilityChange(false);
             setIsBackButtonHidden(true);
        } else {
             onHeaderVisibilityChange(true);
             setIsBackButtonHidden(false);
        }
    }
  }, [start, status, onHeaderVisibilityChange, setIsBackButtonHidden, organization, isAutoTransition, isLobbyMode]);

  const handleLobbyStart = () => {
      setIsLobbyMode(false);
      start(); // Trigger timer start
  };

  const [finishedParticipants, setFinishedParticipants] = useState<Record<string, FinishData>>({});
  const [savingParticipant, setSavingParticipant] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [showBackToPrepConfirmation, setShowBackToPrepConfirmation] = useState(false);
  const [showFinishAnimation, setShowFinishAnimation] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [isSavingRace, setIsSavingRace] = useState(false);
  const [finalRaceId, setFinalRaceId] = useState<string | null>(null);
  const [isClockFrozen, setIsClockFrozen] = useState(false);
  const [frozenTime, setFrozenTime] = useState(0);

  // Hyrox premium states
  const [screenMode, setScreenMode] = useState<'tv' | 'official'>(() => {
    if (activeWorkout?.openAsOfficial) return 'official';
    if (isStudioMode) return 'tv';
    return 'official';
  });
  const [isDarkTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState(new Date());
  const [officialSearchQuery, setOfficialSearchQuery] = useState('');
  const [officialActiveTab, setOfficialActiveTab] = useState<'running' | 'finished'>('running');
  const [confirmFinishId, setConfirmFinishId] = useState<string | null>(null);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeOfDay(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Hyrox and Mode setup
  const isHyroxRace = useMemo(() => activeWorkout?.id.startsWith('hyrox-full-race') || activeWorkout?.id.includes('custom-race'), [activeWorkout]);
  const isFreestanding = block.tag === 'Fristående';
  const showFullScreenColor = isFreestanding;

  const [startGroups, setStartGroups] = useState<StartGroup[]>([]);
  const startIntervalSeconds = useMemo(() => (activeWorkout?.startIntervalMinutes ?? 2) * 60, [activeWorkout]);

  const nextGroupToStartIndex = useMemo(() => startGroups.findIndex(g => g.startTime === undefined), [startGroups]);
  const nextGroupToStart = useMemo(() => (nextGroupToStartIndex !== -1 ? startGroups[nextGroupToStartIndex] : null), [startGroups, nextGroupToStartIndex]);
  const remainingGroupsCount = useMemo(() => startGroups.filter(g => g.startTime === undefined).length, [startGroups]);

  // Real-time synchronization state for official/functionary view
  const [syncedElapsedSeconds, setSyncedElapsedSeconds] = useState(0);

  // Find the studio that is actually broadcasting or linked to this race
  const activeRaceStudio = useMemo(() => {
    if (!isHyroxRace) return selectedStudio;
    
    // Default fallback to manually selected studio
    const fallback = selectedStudio;
    if (!selectedOrganization?.studios || !activeWorkout?.id) return fallback;
    
    const cleanId = (id: string) => {
      if (!id) return '';
      return id.replace('block-custom-race-', '').replace('custom-race-', '').replace('workout-', '');
    };
    
    const localIdClean = cleanId(activeWorkout.id);
    
    // First, check if selectedStudio is active with this workout
    if (selectedStudio?.remoteState) {
      const remoteIdClean = cleanId(selectedStudio.remoteState.activeWorkoutId || '');
      const isSameInstance = (remoteIdClean && remoteIdClean === localIdClean) ||
                            (selectedStudio.remoteState.raceName === activeWorkout.title);
      if (isSameInstance) return selectedStudio;
    }
    
    // Otherwise scan other studios in organization to find any actively broadcasting studio
    for (const s of selectedOrganization.studios) {
      if (!s.remoteState) continue;
      const remoteIdClean = cleanId(s.remoteState.activeWorkoutId || '');
      const isSameInstance = (remoteIdClean && remoteIdClean === localIdClean) ||
                            (s.remoteState.raceName === activeWorkout.title);
      if (isSameInstance) {
        return s;
      }
    }
    
    return fallback;
  }, [selectedOrganization?.studios, selectedStudio, activeWorkout, isHyroxRace]);

  // Helper to publish current race state to Firestore under selectedStudio's remoteState
  const publishRaceState = useCallback(async (updates: any) => {
    // If we have an activeRaceStudio, target that one. This ensures functionary edits write to the TV's active studio.
    const targetStudio = activeRaceStudio || selectedStudio;
    if (!selectedOrganization?.id || !targetStudio?.id) return;
    try {
      const currentRemote = targetStudio.remoteState || {};
      const mergedState = {
        ...currentRemote,
        ...updates,
        updatedAt: Date.now()
      };
      await updateStudioRemoteState(selectedOrganization.id, targetStudio.id, mergedState);
    } catch (err) {
      console.error("Failed to publish race state:", err);
    }
  }, [selectedOrganization, selectedStudio, activeRaceStudio]);

  // Refs to prevent recursive feedback loops during Firestore syncing
  const lastProcessedRemoteStateRef = useRef<string>('');
  const lastPublishedStateRef = useRef<string>('');

  // TV Publisher: Automatically keep the Firestore remoteState updated when TV state changes
  useEffect(() => {
    if (!isHyroxRace || screenMode !== 'tv') return;

    const remoteState = activeRaceStudio?.remoteState || {};
    
    // Check if we need to update
    const statusMap: Record<TimerStatus, string> = {
      [TimerStatus.Idle]: 'idle',
      [TimerStatus.Preparing]: 'preparing',
      [TimerStatus.Running]: 'running',
      [TimerStatus.Resting]: 'resting',
      [TimerStatus.Paused]: 'paused',
      [TimerStatus.Finished]: 'completed'
    };
    
    const currentMappedStatus = statusMap[status] || 'idle';
    
    const currentStateStr = JSON.stringify({
      status: currentMappedStatus,
      startGroups,
      finishedParticipants,
      activeWorkoutId: activeWorkout?.id
    });

    // If it matches what we last published, do not publish again to avoid spamming
    if (lastPublishedStateRef.current === currentStateStr) {
      return;
    }

    // Also compare against incoming remoteState to prevent duplicate writes
    const remoteStateStr = JSON.stringify({
      status: remoteState.status || 'idle',
      startGroups: remoteState.startGroups || [],
      finishedParticipants: remoteState.finishedParticipants || {},
      activeWorkoutId: remoteState.activeWorkoutId
    });

    if (remoteStateStr === currentStateStr) {
      lastPublishedStateRef.current = currentStateStr; // sync ref
      return;
    }

    // Prepare updates
    const updates: any = {};
    let hasChanges = false;

    if (remoteState.status !== currentMappedStatus) {
      updates.status = currentMappedStatus;
      hasChanges = true;

      if (status === TimerStatus.Running) {
        updates.timerStartTime = Date.now();
        updates.timerBase = totalTimeElapsed;
      } else {
        updates.timerStartTime = null;
        updates.timerBase = totalTimeElapsed;
        updates.lastElapsedSeconds = totalTimeElapsed;
      }
    }

    if (JSON.stringify(remoteState.startGroups) !== JSON.stringify(startGroups)) {
      updates.startGroups = startGroups;
      hasChanges = true;
    }

    if (JSON.stringify(remoteState.finishedParticipants) !== JSON.stringify(finishedParticipants)) {
      updates.finishedParticipants = finishedParticipants;
      hasChanges = true;
    }

    // Always ensure activeWorkout/raceInfo is set so officials connect to the right race
    if (remoteState.activeWorkoutId !== activeWorkout?.id || remoteState.raceName !== activeWorkout?.title) {
      updates.activeWorkoutId = activeWorkout?.id;
      updates.raceName = activeWorkout?.title;
      hasChanges = true;
    }

    if (hasChanges) {
      lastPublishedStateRef.current = currentStateStr;
      publishRaceState(updates);
    }
  }, [
    status, 
    startGroups, 
    finishedParticipants, 
    isHyroxRace, 
    screenMode, 
    activeWorkout, 
    publishRaceState, 
    activeRaceStudio?.remoteState
  ]);

  // Sync state from remoteState (Subscriber)
  useEffect(() => {
    if (!isHyroxRace || !activeRaceStudio?.remoteState) return;
    
    const remoteState = activeRaceStudio.remoteState;
    
    const cleanId = (id: string) => {
      if (!id) return '';
      return id.replace('block-custom-race-', '').replace('custom-race-', '').replace('workout-', '');
    };
    
    const remoteIdClean = cleanId(remoteState.activeWorkoutId);
    const localIdClean = cleanId(activeWorkout?.id);
    
    const isSameWorkout = (remoteIdClean && remoteIdClean === localIdClean) || 
                          (remoteState.raceName && remoteState.raceName === activeWorkout?.title) ||
                          (activeWorkout?.title && remoteState.raceName?.toLowerCase() === activeWorkout.title.toLowerCase());
                          
    if (!isSameWorkout) return;

    // Fast check to see if we already applied this specific database snapshot
    const remoteStateStr = JSON.stringify({
      status: remoteState.status,
      startGroups: remoteState.startGroups,
      finishedParticipants: remoteState.finishedParticipants
    });

    if (lastProcessedRemoteStateRef.current === remoteStateStr) {
      return;
    }
    lastProcessedRemoteStateRef.current = remoteStateStr;

    // 1. Sync finishedParticipants (both TV and official panels!)
    if (remoteState.finishedParticipants) {
      setFinishedParticipants(remoteState.finishedParticipants);
    }

    // 2. Sync startGroups
    if (remoteState.startGroups) {
      setStartGroups(remoteState.startGroups);
    }

    // 3. Sync status / controls for official/viewer mode
    if (remoteState.status === 'completed') {
      if (remoteState.finalRaceId) {
        onFinish({ isNatural: true, raceId: remoteState.finalRaceId });
      }
    } else if (screenMode === 'official') {
      if (remoteState.status === 'running') {
        setIsLobbyMode(false);
        if (status !== TimerStatus.Running) {
          start({ skipPrep: true });
        }
      } else if (remoteState.status === 'paused') {
        if (status === TimerStatus.Running) {
          pause();
        }
      } else if (remoteState.status === 'idle') {
        setIsLobbyMode(true);
        reset();
      }
    }
  }, [
    activeRaceStudio?.remoteState, 
    isHyroxRace, 
    activeWorkout, 
    screenMode, 
    status, 
    start, 
    pause, 
    reset,
    showFinishAnimation
  ]);

  // Sync elapsed seconds for official/functionary view
  useEffect(() => {
    if (screenMode !== 'official') return;

    const updateTime = () => {
      const remoteState = activeRaceStudio?.remoteState;
      if (!remoteState) {
        setSyncedElapsedSeconds(0);
        return;
      }

      if (remoteState.status === 'running' && remoteState.timerStartTime) {
        const now = Date.now();
        const elapsed = (remoteState.timerBase || 0) + Math.floor((now - remoteState.timerStartTime) / 1000);
        setSyncedElapsedSeconds(Math.max(0, elapsed));
      } else {
        setSyncedElapsedSeconds(remoteState.lastElapsedSeconds || 0);
      }
    };

    updateTime();

    const remoteState = activeRaceStudio?.remoteState;
    if (remoteState?.status === 'running') {
      const intervalId = setInterval(updateTime, 250);
      return () => clearInterval(intervalId);
    }
  }, [activeRaceStudio?.remoteState, screenMode]);

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
    if (status === TimerStatus.Finished && !isHyroxRace && block.settings.mode !== TimerMode.Stopwatch) {
        if (block.autoAdvance && nextBlock) return;
        if (hasCalledFinishRef.current) return;
        const timerId = setTimeout(() => { onFinish({ isNatural: true, time: totalTimeElapsed }); hasCalledFinishRef.current = true; }, 500);
        return () => clearTimeout(timerId);
    } else if (status !== TimerStatus.Finished) { hasCalledFinishRef.current = false; }
  }, [status, isHyroxRace, block.settings.mode, block.autoAdvance, nextBlock, onFinish, totalTimeElapsed]);

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
    // RESET LOBBY MODE
    setIsLobbyMode(true);
    reset(); // Reset will stop timer and set status to Idle
  };

  const handleRemoteAction = useCallback(async (action: 'start' | 'pause' | 'resume' | 'reset') => {
      // 1. Perform Local Action IMMEDIATELY
      if (action === 'start') {
          setIsLobbyMode(false);
          start(); 
          publishRaceState({
              status: 'running',
              timerStartTime: Date.now(),
              timerBase: 0,
              lastElapsedSeconds: 0,
              startGroups: startGroups.map(g => ({ ...g, startTime: g.startTime })),
              finishedParticipants: {},
              activeWorkoutId: activeWorkout?.id,
              raceName: activeWorkout?.title
          });
      }
      else if (action === 'pause') {
          if (isTransitioning) setIsTransitionPaused(true);
          else pause();
          publishRaceState({
              status: 'paused',
              lastElapsedSeconds: totalTimeElapsed
          });
      }
      else if (action === 'resume') {
          if (isTransitioning) setIsTransitionPaused(false);
          else resume();
          publishRaceState({
              status: 'running',
              timerStartTime: Date.now(),
              timerBase: totalTimeElapsed,
              lastElapsedSeconds: totalTimeElapsed
          });
      }
      else if (action === 'reset') {
          handleConfirmReset();
          publishRaceState({
              status: 'idle',
              timerStartTime: null,
              timerBase: 0,
              lastElapsedSeconds: 0,
              startGroups: startGroups.map(g => ({ ...g, startTime: undefined })),
              finishedParticipants: {},
              activeWorkoutId: activeWorkout?.id,
              raceName: activeWorkout?.title
          });
      }
  }, [selectedOrganization, selectedStudio, activeWorkout, block.id, start, pause, resume, isTransitioning, isLobbyMode, handleConfirmReset, startGroups, totalTimeElapsed, publishRaceState]);

  useEffect(() => { return () => stopAllAudio(); }, [stopAllAudio]);

  useEffect(() => {
    // If the race is already running (locally or remotely), do not overwrite with unstarted groups!
    const isRunningRemotely = activeRaceStudio?.remoteState?.status === 'running' || activeRaceStudio?.remoteState?.status === 'paused';
    if (status === TimerStatus.Running || status === TimerStatus.Paused || isRunningRemotely) {
        return;
    }

    if (isHyroxRace) {
        if (activeWorkout?.startGroups && activeWorkout.startGroups.length > 0) {
            setStartGroups(activeWorkout.startGroups.map(g => ({ ...g, startTime: undefined })));
        } else if (activeWorkout) { 
            setStartGroups([{ id: `group-${Date.now()}`, name: 'Startgrupp 1', participants: (activeWorkout.participants || []).join('\n'), startTime: undefined }]);
        } else { setStartGroups([]); }
    } else { setStartGroups([]); }
  }, [isHyroxRace, activeWorkout, status, activeRaceStudio?.remoteState?.status]);

  useEffect(() => {
      if (!isHyroxRace || status !== TimerStatus.Running || screenMode !== 'tv') return;
      const groupsToStart = startGroups.filter((group, index) => { const expectedStartTime = index * startIntervalSeconds; return group.startTime === undefined && totalTimeElapsed >= expectedStartTime; });
      if (groupsToStart.length > 0) {
          setStartGroups(prevGroups => {
              const newGroups = [...prevGroups];
              groupsToStart.forEach(groupToStart => {
                  const index = newGroups.findIndex(g => g.id === groupToStart.id);
                  if (index !== -1) { newGroups[index] = { ...newGroups[index], startTime: index * startIntervalSeconds }; }
              });
              
              if (screenMode === 'tv') {
                  publishRaceState({ startGroups: newGroups });
              }
              
              return newGroups;
          });
      }
  }, [isHyroxRace, totalTimeElapsed, startGroups, status, startIntervalSeconds, screenMode, publishRaceState]);

  useEffect(() => {
      if (status === TimerStatus.Preparing) return;
      if (isHyroxRace && groupForCountdownDisplay && timeForCountdownDisplay > 0 && timeForCountdownDisplay <= 3) playShortBeep();
  }, [isHyroxRace, timeForCountdownDisplay, groupForCountdownDisplay, status]);

  // --- HYROX HANDLERS ---
  const startedParticipants = useMemo(() => {
    return startGroups.filter(g => g.startTime !== undefined).flatMap(g => {
        if (g.participantList && g.participantList.length > 0) {
            return g.participantList;
        }
        // Fallback for legacy string participants
        return g.participants.split('\n').map(p => p.trim()).filter(Boolean).map((name, index) => ({
            id: `legacy-${g.id}-${index}`,
            name,
            startNumber: index + 1
        }));
    });
  }, [startGroups]);

  const handleParticipantFinish = (participantId: string) => {
    setSavingParticipant(participantId);
    
    // Find the group that contains this participant
    const group = startGroups.find(g => {
        if (g.participantList && g.participantList.length > 0) {
            return g.participantList.some(p => p.id === participantId);
        }
        // Fallback for legacy string participants where participantId is actually the name/id generated in startedParticipants
        // The generated ID is `legacy-${g.id}-${index}`, so we can check if participantId starts with `legacy-${g.id}`
        return participantId.startsWith(`legacy-${g.id}`);
    });

    if (group?.startTime !== undefined) {
      const currentElapsed = screenMode === 'official' ? syncedElapsedSeconds : totalTimeElapsed;
      const netTime = Math.max(0, currentElapsed - group.startTime);
      setFinishedParticipants(prev => {
        const next = {
          ...prev,
          [participantId]: { time: netTime, placement: Object.keys(prev).length + 1 }
        };
        publishRaceState({ finishedParticipants: next });
        return next;
      });
      
      // Try to find the actual name for the speech synthesis
      let participantName = participantId;
      if (group.participantList && group.participantList.length > 0) {
          const p = group.participantList.find(p => p.id === participantId);
          if (p) {
              if (p.teamName) {
                  participantName = p.teamName;
              } else if (p.partnerName) {
                  participantName = `${p.name} och ${p.partnerName}`;
              } else {
                  participantName = p.name;
              }
          }
      } else {
          // Extract name from legacy participants based on index
          const match = participantId.match(/legacy-.*-(\d+)/);
          if (match) {
              const index = parseInt(match[1], 10);
              const names = group.participants.split('\n').map(p => p.trim()).filter(Boolean);
              if (names[index]) participantName = names[index];
          }
      }
      
      speak(`Målgång ${participantName}!`);
    }
    setSavingParticipant(null);
  };

  const handleEditParticipant = (name: string) => {
    setParticipantToEdit(name);
  };

  const handleUpdateResult = (newTime: number) => {
    if (participantToEdit) {
      setFinishedParticipants(prev => {
        const next = {
          ...prev,
          [participantToEdit]: { ...prev[participantToEdit], time: newTime }
        };
        publishRaceState({ finishedParticipants: next });
        return next;
      });
      setParticipantToEdit(null);
    }
  };

  const handleAddPenalty = () => {
    if (participantToEdit) {
      setFinishedParticipants(prev => {
        const next = {
          ...prev,
          [participantToEdit]: { ...prev[participantToEdit], time: prev[participantToEdit].time + 60 }
        };
        publishRaceState({ finishedParticipants: next });
        return next;
      });
      setParticipantToEdit(null);
    }
  };

  const handleRemoveResult = () => {
    if (participantToEdit) {
      setFinishedParticipants(prev => {
        const next = { ...prev };
        delete next[participantToEdit];
        publishRaceState({ finishedParticipants: next });
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
      const winnerId = sortedFinishers.length > 0 ? sortedFinishers[0][0] : null;
      
      let winnerDisplayName = winnerId;
      if (winnerId) {
          const found = startedParticipants.find(p => p.id === winnerId);
          if (found) {
              if (found.teamName) {
                  winnerDisplayName = found.teamName;
              } else if (found.partnerName) {
                  winnerDisplayName = `${found.name} och ${found.partnerName}`;
              } else {
                  winnerDisplayName = found.name;
              }
          }
      }

      // Calculate top 3 per division
      const divisionWinners: { 
          division: string; 
          top3: { 
              rank: number; 
              name: string; 
              time: number;
              startNumber?: number;
              teamName?: string;
              partnerName?: string;
          }[] 
      }[] = [];
      sortedFinishers.forEach(([participantId, data]) => {
          const participant = startedParticipants.find(p => p.id === participantId);
          const division = participant?.division || 'Standard';
          
          let displayName = participantId;
          if (participant) {
              if (participant.teamName) {
                  displayName = participant.teamName;
              } else if (participant.partnerName) {
                  displayName = `${participant.name} & ${participant.partnerName}`;
              } else {
                  displayName = participant.name;
              }
          }
          
          let divObj = divisionWinners.find(d => d.division === division);
          if (!divObj) {
              divObj = { division, top3: [] };
              divisionWinners.push(divObj);
          }
          
          divObj.top3.push({
              rank: divObj.top3.length + 1,
              name: displayName,
              time: (data as FinishData).time,
              startNumber: participant?.startNumber === null ? undefined : participant?.startNumber,
              teamName: participant?.teamName || undefined,
              partnerName: participant?.partnerName || undefined
          });
      });

      const serializedWinnersObj = JSON.stringify({
          fallback: winnerDisplayName || '',
          divisions: divisionWinners
      });
      
      setWinnerName(serializedWinnersObj);
      
      const raceResults = sortedFinishers.map(([participantId, data]) => {
          const group = startGroups.find(g => {
              if (g.participantList && g.participantList.length > 0) {
                  return g.participantList.some(p => p.id === participantId);
              }
              return participantId.startsWith(`legacy-${g.id}`);
          });
          
          let displayName = participantId;
          let partnerName: string | undefined = undefined;
          
          const found = startedParticipants.find(p => p.id === participantId);
          if (found) {
              displayName = found.name;
              partnerName = found.partnerName;
          }
          
          return { 
              participant: partnerName ? `${displayName} & ${partnerName}` : displayName, 
              time: (data as FinishData).time, 
              groupId: group?.id || 'unknown',
              ...(partnerName ? { partnerName } : {}),
              email: found?.email || undefined,
              partnerEmail: found?.partnerEmail || undefined,
              teamName: found?.teamName || undefined,
              division: found?.division || undefined
          };
      });

      try {
          // Extract the original race ID if it was a planned race
          let originalRaceId = undefined;
          if (activeWorkout.id && activeWorkout.id.startsWith('custom-race-') && activeWorkout.id !== 'custom-race') {
              originalRaceId = activeWorkout.id.replace('custom-race-', '');
          }

          const raceData: any = {
              raceName: activeWorkout.title,
              exercises: block.exercises?.map(e => `${e.reps || ''} ${e.name}`.trim()) || [],
              startGroups: startGroups.map(g => ({
                  id: g.id,
                  name: g.name,
                  participants: g.participants,
                  participantList: g.participantList || []
              })),
              results: raceResults,
              status: 'completed'
          };
          
          if (originalRaceId) {
              raceData.id = originalRaceId;
          }
          
          const savedRace = await saveRace(raceData, organization.id);
          if (savedRace && savedRace.id) {
              setFinalRaceId(savedRace.id);
              setWinnerName(serializedWinnersObj);
              
              // Publish the completed state to firebase studio remote state so TV/viewer screens update
              publishRaceState({
                  status: 'completed',
                  finalRaceId: savedRace.id,
                  winnerName: serializedWinnersObj
              });

              if (winnerDisplayName) speak(`Och vinnaren är ${winnerDisplayName}! Bra jobbat alla!`);

              // Navigera direkt till den detaljerade resultatsidan och hoppa över popup-mellansteget
              onFinish({ isNatural: true, raceId: savedRace.id });
          } else {
              throw new Error("Missing raceId from server response");
          }
      } catch (error) {
          console.error("Failed to save race:", error);
          alert("Kunde inte spara loppet. Kontrollera din anslutning.");
      } finally {
          setIsSavingRace(false);
      }
  }, [isHyroxRace, activeWorkout, finishedParticipants, block.exercises, startGroups, organization, speak, startedParticipants]);

  const timerStyle = getTimerStyle(status, block.settings.mode, isHyroxRace, isTransitioning, currentSegment);
  
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
          case TimerMode.Custom: return "SEKVENS";
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
      
      // CUSTOM LABELS
      if (block.settings.mode === TimerMode.Custom && currentSegment) {
          if (status === TimerStatus.Preparing) return "Gör dig redo";
          if (status === TimerStatus.Finished) return "Klar";
          // Use segment title or default
          return currentSegment.title || (currentSegment.type === 'work' ? "ARBETE" : "VILA");
      }

      switch (status) {
          case TimerStatus.Preparing: return "Gör dig redo";
          case TimerStatus.Running: return "Arbete";
          case TimerStatus.Resting: return "Vila";
          case TimerStatus.Paused: return "Pausad";
          case TimerStatus.Finished: return "Klar";
          default: return "Redo";
      }
  }, [status, isHyroxRace, isTransitioning, nextBlock, block.settings.mode, currentSegment]);

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
  
  // Autostart 2.0 Mode Detection
  const isAutostartMode = useMemo(() => {
      if (!activeWorkout) return false;
      // FIX: Vi kollar nu om DET AKTUELLA blocket (block) har autostart påslaget,
      // istället för att kolla om *något* block i hela passet har det.
      return activeWorkout.blocks.length > 1 && block.autoAdvance;
  }, [activeWorkout, block.autoAdvance]);

  const isRestNext = block.autoAdvance && (block.transitionTime || 0) > 0 && status !== TimerStatus.Resting;
  
  // --- VIKTAD HÖJDFÖRDELNING ---
  const getBlockWeight = (block: WorkoutBlock) => {
    // 2 poäng för header/titel, 1 poäng per övning
    return 2 + (block.exercises?.length || 0);
  };

  const restartHideTimer = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (status === TimerStatus.Running || status === TimerStatus.Resting || status === TimerStatus.Preparing || isTransitioning) {
        hideTimeoutRef.current = window.setTimeout(() => { setControlsVisible(false); onHeaderVisibilityChange(false); setIsBackButtonHidden(true); }, 3000); 
    }
  }, [status, isTransitioning, onHeaderVisibilityChange, setIsBackButtonHidden]);

  const handleInteraction = React.useCallback(() => { setControlsVisible(true); onHeaderVisibilityChange(true); setIsBackButtonHidden(false); restartHideTimer(); }, [onHeaderVisibilityChange, setIsBackButtonHidden, restartHideTimer]);

  // Show controls on mouse move or touch
  useEffect(() => {
      window.addEventListener('mousemove', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
      return () => {
          window.removeEventListener('mousemove', handleInteraction);
          window.removeEventListener('touchstart', handleInteraction);
      };
  }, [handleInteraction]);

  useEffect(() => {
    if (controlsVisible) restartHideTimer();
    return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); };
  }, [controlsVisible, restartHideTimer]);

  useEffect(() => {
    if (status === TimerStatus.Running || status === TimerStatus.Preparing || status === TimerStatus.Resting || isTransitioning) {
        restartHideTimer();
    } else if (isLobbyMode) { 
        setControlsVisible(true); 
        onHeaderVisibilityChange(true); 
        setIsBackButtonHidden(false); 
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); 
    }
  }, [status, restartHideTimer, onHeaderVisibilityChange, setIsBackButtonHidden, isTransitioning, isLobbyMode]);

  const isActuallyPaused = status === TimerStatus.Paused || (isTransitioning && isTransitionPaused);
  const isActuallyFinishedOrIdle = (status === TimerStatus.Idle || status === TimerStatus.Finished) && !isTransitioning;

  // --- Calculate total sequence duration for Custom Mode ---
  const singleSequenceDuration = block.settings.sequence ? block.settings.sequence.reduce((acc, s) => acc + (s.duration || 0), 0) : 0;
  const totalSequenceDuration = singleSequenceDuration * (block.settings.rounds || 1);

  const upcomingText = useMemo(() => {
      if (status !== TimerStatus.Running || currentTime > 10) return null;
      
      const { mode, restTime } = block.settings;
      
      if (mode === TimerMode.Custom) {
          if (nextSegment) {
              return nextSegment.type === 'rest' ? 'Vila' : (nextSegment.title || 'Nästa övning');
          }
      } else if (mode === TimerMode.Interval || mode === TimerMode.Tabata || mode === TimerMode.EMOM) {
          if (completedWorkIntervals + 1 >= totalWorkIntervals) return null;

          if (restTime > 0) {
              return 'Vila';
          } else if (nextExercise) {
              return nextExercise.name;
          }
      }
      return null;
  }, [status, currentTime, block.settings, nextSegment, nextExercise, completedWorkIntervals, totalWorkIntervals]);

  // --- HYROX PRESTIGE VIEW RENDERING ---
  const renderHyroxPremiumView = () => {
    const raceId = activeWorkout ? (activeWorkout.id.startsWith('custom-race-') && activeWorkout.id !== 'custom-race' ? activeWorkout.id.replace('custom-race-', '') : activeWorkout.id) : '';
    const allRaceParticipants = startGroups.flatMap(g => {
        if (g.participantList && g.participantList.length > 0) return g.participantList;
        return (g.participants || '').split('\n').map(p => p.trim()).filter(Boolean).map((name, index) => ({
            id: `legacy-${g.id}-${index}`,
            name,
            startNumber: index + 1,
            division: 'Singel Herr'
        }));
    });
    const totalRegistered = allRaceParticipants.length;
    const startedTotal = startedParticipants.length;
    const finishedTotal = Object.keys(finishedParticipants).length;
    const runningTotal = Math.max(0, startedTotal - finishedTotal);

    const formattedTimeOfDay = currentTimeOfDay.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const currentElapsed = screenMode === 'official' ? syncedElapsedSeconds : totalTimeElapsed;
    const raceElapsedMin = Math.floor(currentElapsed / 60).toString().padStart(2, '0');
    const raceElapsedSec = (currentElapsed % 60).toString().padStart(2, '0');

    // Theme values
    const themeBg = isDarkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
    const cardBg = isDarkTheme ? 'bg-slate-900/60 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-md';
    const textMuted = isDarkTheme ? 'text-slate-400' : 'text-slate-500';
    const borderTheme = isDarkTheme ? 'border-slate-800' : 'border-slate-200';

    const getDivisionColor = (div?: string) => {
        const d = div || 'Singel Herr';
        if (d === 'Singel Herr') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        if (d === 'Singel Dam') return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
        if (d === 'Dubbel Herr') return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
        if (d === 'Dubbel Dam') return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
        if (d === 'Dubbel Mix') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    };

    if (screenMode === 'official') {
        // --- FUNKTIONÄRSVY (MOBIL/IPAD) ---
        const uncompletedStartedParticipants = startedParticipants.filter(p => !finishedParticipants[p.id]);
        
        const filteredRunning = uncompletedStartedParticipants.filter(p => {
            const query = officialSearchQuery.toLowerCase().trim();
            if (!query) return true;
            return p.name.toLowerCase().includes(query) || 
                   p.startNumber?.toString().includes(query) || 
                   (p.partnerName && p.partnerName.toLowerCase().includes(query));
        });

        const finishedList = Object.entries(finishedParticipants)
            .map(([id, data]) => {
                const found = allRaceParticipants.find(p => p.id === id);
                return { id, name: found?.name || 'Okänd', division: found?.division || 'Singel Herr', partnerName: found?.partnerName, teamName: found?.teamName, ...data };
            })
            .sort((a, b) => a.time - b.time);

        return (
            <div className={`fixed inset-0 w-full h-full flex flex-col ${themeBg} overflow-hidden z-[45]`}>
                {/* Header */}
                <header className={`px-4 py-3 flex justify-between items-center border-b ${borderTheme}`}>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-500">Funktionärspanel</span>
                        </div>
                        <h2 className="text-sm font-black truncate max-w-[200px] sm:max-w-xs">{activeWorkout?.title || 'Hyrox-simulering'}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {isStudioMode && (
                            <button 
                                onClick={() => setScreenMode('tv')} 
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>TV-Skärm</span>
                            </button>
                        )}
                        <button 
                            onClick={handleExit}
                            className="bg-slate-500/10 hover:bg-slate-500/20 font-bold text-xs px-2.5 py-1.5 rounded-lg"
                        >
                            Avsluta
                        </button>
                    </div>
                </header>

                {/* Sub-header containing actual global clock & stopwatch */}
                <div className={`px-4 py-2 border-b ${borderTheme} flex justify-between items-center text-xs bg-slate-500/5`}>
                    <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                        <span className="font-mono font-bold tracking-tight">Klockslag: {formattedTimeOfDay}</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-mono font-bold text-indigo-500">Tävlingstid: {raceElapsedMin}:{raceElapsedSec}</span>
                    </div>
                </div>

                {/* Tab selector */}
                <div className="flex border-b border-indigo-500/10 text-sm font-bold">
                    <button
                        onClick={() => setOfficialActiveTab('running')}
                        className={`flex-1 py-3 text-center border-b-2 transition-colors ${officialActiveTab === 'running' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
                    >
                        Ute på banan ({uncompletedStartedParticipants.length})
                    </button>
                    <button
                        onClick={() => setOfficialActiveTab('finished')}
                        className={`flex-1 py-3 text-center border-b-2 transition-colors ${officialActiveTab === 'finished' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-100'}`}
                    >
                        I Mål ({finishedList.length})
                    </button>
                </div>

                {/* Search Bar */}
                {officialActiveTab === 'running' && (
                    <div className="p-3">
                        <div className="relative">
                            <input 
                                type="text"
                                placeholder="Sök efter deltagare eller startnummer..."
                                value={officialSearchQuery}
                                onChange={e => setOfficialSearchQuery(e.target.value)}
                                className="w-full text-sm bg-slate-500/5 dark:bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 pl-10 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3.5 top-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                )}

                {/* Lists Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {officialActiveTab === 'running' ? (
                        filteredRunning.length === 0 ? (
                            <div className="text-center py-12 text-sm text-slate-500 italic">
                                {isLobbyMode 
                                    ? "Eventet har inte startats ännu. Starta i TV-vyn först."
                                    : "Inga aktiva löpare ute på banan för tillfället eller hittades ej."}
                            </div>
                        ) : (
                            filteredRunning.map(p => (
                                <div 
                                    key={p.id}
                                    className={`p-3.5 rounded-xl border flex justify-between items-center bg-white dark:bg-slate-900 ${borderTheme}`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-extrabold text-sm text-indigo-500">#{p.startNumber}</span>
                                            <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex flex-col">
                                                {p.teamName ? (
                                                    <>
                                                        <span className="text-sm font-black text-indigo-500 dark:text-indigo-400">{p.teamName}</span>
                                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{p.name} {p.partnerName && <>& {p.partnerName}</>}</span>
                                                    </>
                                                ) : (
                                                    <span>{p.name} {p.partnerName && <> & {p.partnerName}</>}</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                                            <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getDivisionColor(p.division)}`}>
                                                {p.division || 'Singel Herr'}
                                            </span>
                                            {p.email && <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{p.email}</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setConfirmFinishId(p.id)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md uppercase tracking-wider"
                                    >
                                        MÅL
                                    </button>
                                </div>
                            ))
                        )
                    ) : (
                        finishedList.length === 0 ? (
                            <div className="text-center py-12 text-sm text-slate-500 italic">
                                Inga deltagare i mål ännu.
                            </div>
                        ) : (
                            finishedList.map((res, index) => (
                                <div 
                                    key={res.id}
                                    className={`p-3.5 rounded-xl border flex justify-between items-center bg-green-500/5 ${borderTheme}`}
                                >
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-black text-sm text-green-500">#{index+1}</span>
                                            <span className="font-black text-sm text-slate-900 dark:text-slate-100 flex flex-col">
                                                {res.teamName ? (
                                                    <>
                                                        <span className="text-sm font-black text-indigo-500 dark:text-indigo-400">{res.teamName}</span>
                                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{res.name} {res.partnerName && <>& {res.partnerName}</>}</span>
                                                    </>
                                                ) : (
                                                    <span>{res.name} {res.partnerName && <> & {res.partnerName}</>}</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mt-1 items-center">
                                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getDivisionColor(res.division)}`}>
                                                {res.division}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">Placering i klass</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-lg text-slate-900 dark:text-slate-100 mr-1.5">
                                            {Math.floor(res.time / 60)}:{String(res.time % 60).padStart(2, '0')}
                                        </span>
                                        <button
                                            onClick={() => setParticipantToEdit(res.id)}
                                            className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold px-3 py-2 rounded-xl border border-indigo-500/20 uppercase"
                                        >
                                            Ändra
                                        </button>
                                        <button
                                            onClick={() => setConfirmUndoId(res.id)}
                                            className="text-red-500 hover:bg-red-500/10 text-xs font-black p-2 rounded-xl border border-red-500/20 uppercase"
                                            title="Placera tillbaka i loppet"
                                        >
                                            Ångra
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* CONFIRM FINISH POPUP MODAL */}
                {confirmFinishId && (() => {
                    const runner = allRaceParticipants.find(p => p.id === confirmFinishId);
                    if (!runner) return null;
                    const displayName = runner.teamName 
                        ? `${runner.teamName} (${runner.name}${runner.partnerName ? ` & ${runner.partnerName}` : ''})`
                        : `${runner.name}${runner.partnerName ? ` & ${runner.partnerName}` : ''}`;
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                            <div className={`w-full max-w-sm rounded-2xl p-6 border ${cardBg}`}>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Bekräfta målgång</h3>
                                <p className="text-sm mb-4 leading-relaxed">
                                    Vill du registrera målgång för <strong className="text-indigo-500">{displayName}</strong> nu? <br />
                                    Tävlingstid: <span className="font-mono font-bold text-lg text-indigo-500">{raceElapsedMin}:{raceElapsedSec}</span>
                                </p>
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => {
                                            handleParticipantFinish(confirmFinishId);
                                            setConfirmFinishId(null);
                                        }}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-extrabold text-sm py-3 rounded-xl uppercase tracking-wider shadow"
                                    >
                                        Ja, Registrera
                                    </button>
                                    <button
                                        onClick={() => setConfirmFinishId(null)}
                                        className="bg-slate-500/20 hover:bg-slate-500/30 font-bold text-sm px-4 py-3 rounded-xl dark:text-white"
                                    >
                                        Avbryt
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* CONFIRM UNDO POPUP MODAL */}
                {confirmUndoId && (() => {
                    const runner = finishedList.find(r => r.id === confirmUndoId);
                    if (!runner) return null;
                    const displayName = runner.teamName 
                        ? `${runner.teamName} (${runner.name}${runner.partnerName ? ` & ${runner.partnerName}` : ''})`
                        : `${runner.name}${runner.partnerName ? ` & ${runner.partnerName}` : ''}`;
                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                            <div className={`w-full max-w-sm rounded-2xl p-6 border ${cardBg}`}>
                                <h3 className="text-lg font-black text-red-500 mb-2">Ångra målgång?</h3>
                                <p className="text-sm mb-4 leading-relaxed text-slate-700 dark:text-slate-300">
                                    Vill du ta bort målgången för <strong>{displayName}</strong> och placera dem ute på banan igen? Deras tidmätning kommer att återupptas.
                                </p>
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => {
                                            setFinishedParticipants(prev => {
                                                const next = { ...prev };
                                                delete next[confirmUndoId];
                                                publishRaceState({ finishedParticipants: next });
                                                return next;
                                            });
                                            setConfirmUndoId(null);
                                        }}
                                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm py-3 rounded-xl uppercase tracking-wider shadow"
                                    >
                                        Ja, Återställ till lopp
                                    </button>
                                    <button
                                        onClick={() => setConfirmUndoId(null)}
                                        className="bg-slate-500/20 hover:bg-slate-500/30 font-bold text-sm px-4 py-3 rounded-xl dark:text-white"
                                    >
                                        Avbryt
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {participantToEdit && (
                    <EditResultModal 
                        participantName={startedParticipants.find(p => p.id === participantToEdit)?.name || participantToEdit}
                        currentTime={finishedParticipants[participantToEdit]?.time || 0}
                        onSave={handleUpdateResult}
                        onAddPenalty={handleAddPenalty}
                        onUndo={handleRemoveResult}
                        onCancel={() => setParticipantToEdit(null)}
                    />
                )}
            </div>
        );
    }

    // --- TV / STORSKÄRM (BENTO-GRID) ---
    // Calculate live division standings
    const activeDivisions = Array.from(new Set(allRaceParticipants.map(p => p.division || 'Singel Herr')));
    
    // Sort and rank participants within each division
    const divisionStandings = activeDivisions.map(div => {
        const runners = allRaceParticipants.filter(p => (p.division || 'Singel Herr') === div);
        
        const rankedRunners = runners.map(p => {
            const isFinished = !!finishedParticipants[p.id];
            let netTime = 999999;
            let statusStr: 'unstarted' | 'running' | 'finished' = 'unstarted';

            if (isFinished) {
                netTime = finishedParticipants[p.id].time;
                statusStr = 'finished';
            } else {
                const group = startGroups.find(g => g.participantList?.some(x => x.id === p.id));
                if (group && group.startTime !== undefined) {
                    netTime = Math.max(0, totalTimeElapsed - group.startTime);
                    statusStr = 'running';
                }
            }

            return { p, time: netTime, status: statusStr };
        });

        // Sort: finished (by time asc), then running (by time asc), then unstarted
        rankedRunners.sort((a, b) => {
            if (a.status === 'finished' && b.status === 'finished') return a.time - b.time;
            if (a.status === 'finished') return -1;
            if (b.status === 'finished') return 1;
            if (a.status === 'running' && b.status === 'running') return a.time - b.time;
            if (a.status === 'running') return -1;
            if (b.status === 'running') return 1;
            return 0;
        });

        return { division: div, stand: rankedRunners.slice(0, 3) };
    });

    const latestFinisherList = Object.entries(finishedParticipants)
        .map(([id, data]) => {
            const found = allRaceParticipants.find(p => p.id === id);
            return { id, name: found?.name || 'Okänd', division: found?.division || 'Singel Herr', partnerName: found?.partnerName, teamName: found?.teamName, ...data };
        })
        .sort((a, b) => (b.placement || 0) - (a.placement || 0))
        .slice(0, 4);

    return (
        <div className={`fixed inset-0 w-full h-full flex flex-col p-6 overflow-y-auto ${themeBg} transition-colors duration-500 z-[45]`}>
            {/* Header Control Panel */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    {/* Tillbaka-knapp i vänstra hörnet, men bara tills eventet startat (lobby mode) */}
                    {isLobbyMode && (
                        <button 
                            onClick={handleExit}
                            className="bg-slate-500/10 hover:bg-slate-500/20 text-slate-800 dark:text-slate-200 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                            Tillbaka
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-black text-[9px] uppercase tracking-widest">Live Event</span>
                        <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{activeWorkout?.title || 'HYROX Tävlingssimulering'}</h1>
                    </div>
                </div>
            </div>

            {/* STACKED FULL-WIDTH BENTO ROWS CONTAINER */}
            <div className="flex flex-col gap-6 w-full flex-grow">
                
                {/* ROW 1: MASSIVE REAL-TIME CLOCK (KLOCKA SOM TAR HELA BREDDEN) */}
                <div className={`p-8 rounded-3xl border ${cardBg} text-center flex flex-col justify-center items-center shadow-lg relative overflow-hidden`}>
                    <div className="absolute top-4 left-6 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${textMuted}`}>AKTUELL TID (KLOCKA)</span>
                    </div>

                    <div className="font-mono font-black text-8xl sm:text-9xl md:text-[11rem] tracking-tighter select-none tabular-nums text-slate-900 dark:text-amber-400 my-4 drop-shadow-sm leading-none flex items-baseline justify-center">
                        {currentTimeOfDay.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-4xl sm:text-5xl md:text-7xl font-light ml-2 text-slate-400 dark:text-slate-500">
                            :{currentTimeOfDay.toLocaleTimeString('sv-SE', { second: '2-digit' })}
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                            <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">TÄVLINGSTID:</span>
                            <span className="font-mono font-black text-xl text-slate-800 dark:text-slate-100">{raceElapsedMin}:{raceElapsedSec}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">LIVERESULTAT:</span>
                            <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-300">MINDMOTE.SE/LIVE</span>
                        </div>
                    </div>

                    {/* Controls on the top right */}
                    <div className="absolute bottom-4 right-6 flex gap-2">
                        {isLobbyMode ? (
                            <button 
                                onClick={handleLobbyStart}
                                className="bg-green-600 hover:bg-green-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md uppercase tracking-wide"
                            >
                                Starta Event
                            </button>
                        ) : (
                            <>
                                {status === TimerStatus.Running ? (
                                    <button 
                                        onClick={() => handleRemoteAction('pause')}
                                        className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl"
                                    >
                                        Pausa
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleRemoteAction('resume')}
                                        className="bg-green-600 hover:bg-green-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl"
                                    >
                                        Fortsätt
                                    </button>
                                )}
                                <button 
                                    onClick={() => setShowResetConfirmation(true)}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs px-3 py-2 rounded-xl border border-red-500/20"
                                >
                                    Nollställ
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ROW 2: CONDITIONAL COUNTDOWNS & REMAINING START GROUPS */}
                {remainingGroupsCount > 0 && (
                    <div className="flex flex-col gap-6">
                        {/* Countdown inside startgroups */}
                        {groupForCountdownDisplay && timeForCountdownDisplay > 0 && (
                            <div className="p-8 rounded-3xl border border-orange-500/30 bg-orange-500/5 shadow-md flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                                <div>
                                    <span className="inline-block px-3 py-1 rounded bg-orange-500 text-black text-[10px] uppercase font-black tracking-widest mb-2">NÄSTA STARTGRUPP PÅ GÅNG</span>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{groupForCountdownDisplay.name}</h3>
                                    <p className={`text-sm ${textMuted} mt-1`}>{remainingGroupsCount} av {startGroups.length} startgrupper kvar att starta.</p>
                                </div>
                                <div className="font-mono text-6xl sm:text-7xl font-black text-orange-550 dark:text-orange-400 bg-orange-500/10 px-8 py-5 rounded-2xl border border-orange-500/20">
                                    {Math.floor(timeForCountdownDisplay / 60)}:{String(timeForCountdownDisplay % 60).padStart(2, '0')}
                                </div>
                            </div>
                        )}

                        {/* Remaining Upcoming groups list with members (som försvinner en efter en) */}
                        <div className={`p-6 rounded-3xl border ${cardBg} shadow-lg`}>
                            <h3 className="text-xs font-black tracking-widest text-indigo-500 uppercase mb-4 pl-1">Kommande startgrupper</h3>
                            {(() => {
                                const upcomingGroups = startGroups.filter(g => g.startTime === undefined);
                                const gridCols = upcomingGroups.length === 1 
                                    ? 'grid-cols-1 max-w-2xl mx-auto' 
                                    : upcomingGroups.length === 2 
                                        ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto' 
                                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
                                
                                return (
                                    <div className={`grid gap-6 ${gridCols}`}>
                                        {upcomingGroups.map((group, groupIndex) => {
                                            const expectedStartTime = groupIndex * startIntervalSeconds;
                                            const participantNames = group.participantList && group.participantList.length > 0
                                                ? group.participantList.map(p => p.partnerName ? `${p.name} & ${p.partnerName}` : p.name)
                                                : group.participants.split('\n').map(p => p.trim()).filter(Boolean);
                                            
                                            const isLargeCard = upcomingGroups.length <= 2;
                                            
                                            return (
                                                <div key={group.id} className={`rounded-2xl border border-slate-500/10 bg-slate-500/5 flex flex-col justify-between h-full transition-all ${isLargeCard ? 'p-8 shadow-md' : 'p-5'}`}>
                                                    <div>
                                                        <div className="flex justify-between items-start mb-3">
                                                            <h4 className={`font-black text-slate-900 dark:text-white uppercase ${isLargeCard ? 'text-2xl tracking-tight' : 'text-base'}`}>{group.name}</h4>
                                                            <span className={`font-mono font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full ${isLargeCard ? 'text-xs px-3 py-1.5' : 'text-[10px]'}`}>
                                                                +{Math.floor(expectedStartTime / 60)}:{String(expectedStartTime % 60).padStart(2, '0')} s
                                                            </span>
                                                        </div>
                                                        <div className={`space-y-2 mt-4`}>
                                                            {group.participantList && group.participantList.length > 0 ? (
                                                                group.participantList.map((p, idx2) => (
                                                                    <div key={p.id || idx2} className={`flex items-center gap-2 border-b border-slate-500/5 last:border-b-0 text-slate-700 dark:text-gray-300 ${isLargeCard ? 'text-sm py-2 px-1' : 'text-xs py-1'}`}>
                                                                        <span className={`rounded-full bg-slate-500/10 flex items-center justify-center font-bold text-slate-500 flex-shrink-0 ${isLargeCard ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]'}`}>
                                                                            {idx2 + 1}
                                                                        </span>
                                                                        <div className="flex flex-col min-w-0">
                                                                            {p.teamName && (
                                                                                <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 leading-tight">
                                                                                    {p.teamName}
                                                                                </span>
                                                                            )}
                                                                            <span className="font-semibold truncate">
                                                                                {p.partnerName ? `${p.name} & ${p.partnerName}` : p.name}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                participantNames.map((name, idx2) => (
                                                                    <div key={name + idx2} className={`flex items-center gap-2 border-b border-slate-500/5 last:border-b-0 text-slate-700 dark:text-gray-300 ${isLargeCard ? 'text-sm py-2 px-1' : 'text-xs py-1'}`}>
                                                                        <span className={`rounded-full bg-slate-500/10 flex items-center justify-center font-bold text-slate-500 flex-shrink-0 ${isLargeCard ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]'}`}>
                                                                            {idx2 + 1}
                                                                        </span>
                                                                        <span className="font-semibold truncate">{name}</span>
                                                                    </div>
                                                                ))
                                                            )}
                                                            {participantNames.length === 0 && (
                                                                <p className="text-[10px] text-slate-550 italic">Inga deltagare registrerade.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* ROW 3: EVENT ACTIVE VIEW (STATISTIK, LEADERBOARDS & QR CODE) */}
                {(!isLobbyMode && remainingGroupsCount === 0) && (
                    <div className="flex flex-col gap-6 w-full">
                        {/* statistiken under klockan */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                            <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10 hover:shadow-md transition-shadow">
                                <span className="block text-4xl sm:text-5xl font-black text-blue-500 tracking-tight">{runningTotal}</span>
                                <span className={`text-xs font-black uppercase tracking-widest ${textMuted} mt-1 block`}>Ute på banan</span>
                            </div>
                            <div className="p-6 bg-green-500/5 rounded-3xl border border-green-500/10 hover:shadow-md transition-shadow">
                                <span className="block text-4xl sm:text-5xl font-black text-green-500 tracking-tight">{finishedTotal}</span>
                                <span className={`text-xs font-black uppercase tracking-widest ${textMuted} mt-1 block`}>I Mål</span>
                            </div>
                            <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 hover:shadow-md transition-shadow">
                                <span className="block text-4xl sm:text-5xl font-black text-indigo-500 tracking-tight">{startedTotal}</span>
                                <span className={`text-xs font-black uppercase tracking-widest ${textMuted} mt-1 block`}>Startade tot</span>
                            </div>
                        </div>

                        {/* leaderboards grouped horizontally to avoid dividing screen into side columns */}
                        <div className="flex flex-col gap-6">
                            
                            {/* Singles division row */}
                            {divisionStandings.filter(({ division }) => division.toLowerCase().includes('singel')).length > 0 && (
                                <div className={`p-6 rounded-3xl border ${cardBg} shadow-lg space-y-4`}>
                                    <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
                                        <h3 className="font-black text-sm uppercase tracking-wider text-indigo-500 flex items-center gap-2">
                                            SINGELKLASSER (DAMER & HERRAR)
                                        </h3>
                                        <span className={`text-xs ${textMuted}`}>Sorterat efter nettotid</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {divisionStandings
                                            .filter(({ division }) => division.toLowerCase().includes('singel'))
                                            .map(({ division, stand }) => (
                                                <div key={division} className="space-y-3 bg-slate-500/5 p-4 rounded-2xl border border-slate-500/5">
                                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                                        {division}
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {stand.map((res, idx) => {
                                                            const placementBg = idx === 0 ? 'bg-yellow-500 text-black font-black' : idx === 1 ? 'bg-slate-300 text-black font-black' : 'bg-amber-700 text-white font-black';
                                                            const isUnstarted = res.status === 'unstarted';
                                                            return (
                                                                <div key={res.p.id} className={`flex justify-between items-center text-xs p-3 rounded-xl border ${borderTheme} bg-white dark:bg-slate-900`}>
                                                                    <div className="flex items-center gap-2 max-w-[70%]">
                                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${placementBg}`}>
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="font-black truncate">
                                                                            {res.p.name}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {res.status === 'finished' && <span className="text-[8px] font-bold text-green-500 border border-green-500/20 px-1 rounded uppercase">Klar</span>}
                                                                        {res.status === 'running' && <span className="text-[8px] font-bold text-blue-500 border border-blue-500/20 px-1 rounded uppercase">Löp</span>}
                                                                        <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                                                                            {isUnstarted ? 'Ej startad' : `${Math.floor(res.time / 60)}:${String(res.time % 60).padStart(2, '0')}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {stand.length === 0 && <p className="text-xs text-slate-500 italic py-2">Inga deltagare i denna division.</p>}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Team / Doubles division row */}
                            {divisionStandings.filter(({ division }) => !division.toLowerCase().includes('singel')).length > 0 && (
                                <div className={`p-6 rounded-3xl border ${cardBg} shadow-lg space-y-4`}>
                                    <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
                                        <h3 className="font-black text-sm uppercase tracking-wider text-indigo-500 flex items-center gap-2">
                                            DUBBEL- OCH LAGKLASSER
                                        </h3>
                                        <span className={`text-xs ${textMuted}`}>Sorterat efter nettotid</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {divisionStandings
                                            .filter(({ division }) => !division.toLowerCase().includes('singel'))
                                            .map(({ division, stand }) => (
                                                <div key={division} className="space-y-3 bg-slate-500/5 p-4 rounded-2xl border border-slate-500/5">
                                                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                                        {division}
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {stand.map((res, idx) => {
                                                            const placementBg = idx === 0 ? 'bg-yellow-500 text-black font-black' : idx === 1 ? 'bg-slate-300 text-black font-black' : 'bg-amber-700 text-white font-black';
                                                            const isUnstarted = res.status === 'unstarted';
                                                            return (
                                                                <div key={res.p.id} className={`flex justify-between items-center text-xs p-3 rounded-xl border ${borderTheme} bg-white dark:bg-slate-900`}>
                                                                    <div className="flex items-center gap-2 max-w-[70%]">
                                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${placementBg}`}>
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="font-black truncate flex flex-col">
                                                                            {res.p.teamName ? (
                                                                                <>
                                                                                    <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 truncate">{res.p.teamName}</span>
                                                                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{res.p.name} {res.p.partnerName && <>& {res.p.partnerName}</>}</span>
                                                                                </>
                                                                            ) : (
                                                                                <span className="truncate">{res.p.name} {res.p.partnerName && <> & {res.p.partnerName}</>}</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {res.status === 'finished' && <span className="text-[8px] font-bold text-green-500 border border-green-500/20 px-1 rounded uppercase">Klar</span>}
                                                                        {res.status === 'running' && <span className="text-[8px] font-bold text-blue-500 border border-blue-500/20 px-1 rounded uppercase">Löp</span>}
                                                                        <span className="font-mono font-black text-slate-900 dark:text-slate-100">
                                                                            {isUnstarted ? 'Ej startad' : `${Math.floor(res.time / 60)}:${String(res.time % 60).padStart(2, '0')}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {stand.length === 0 && <p className="text-xs text-slate-500 italic py-2">Inga deltagare i denna division.</p>}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ROW 4: LATEST FINISHERS (DE SENASTE SOM GICK I MÅL - UNDER DET DET SENASTE SOM GICK I MÅL) */}
                <div className={`p-6 rounded-3xl border ${cardBg} shadow-lg space-y-4`}>
                    <div className="pb-2 border-b border-indigo-500/10 flex justify-between items-center">
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Senaste målgångar
                        </h3>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Rapporteras live</span>
                    </div>

                    {latestFinisherList.length === 0 ? (
                        <p className="text-center text-xs text-slate-500 py-6 italic">Målgångar rapporteras här i realtid efter hand.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {latestFinisherList.map((f, index) => (
                                <div 
                                    key={f.id + index}
                                    className="flex flex-col p-4 rounded-xl bg-slate-500/5 border border-green-500/15 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 h-full w-1.5 bg-green-500"></div>
                                    <div className="flex justify-between items-start">
                                        <span className="font-black text-xs text-slate-900 dark:text-slate-100 truncate max-w-[70%] flex flex-col">
                                            {f.teamName ? (
                                                <>
                                                    <span className="text-xs font-black text-indigo-500 dark:text-indigo-400 truncate">{f.teamName}</span>
                                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">{f.name} {f.partnerName && <>& {f.partnerName}</>}</span>
                                                </>
                                            ) : (
                                                <span className="truncate">{f.name} {f.partnerName && <> & {f.partnerName}</>}</span>
                                            )}
                                        </span>
                                        <span className="font-mono font-black text-xs text-green-500">
                                            {Math.floor(f.time / 60)}:{String(f.time % 60).padStart(2, '0')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[10px]">
                                        <span className={`px-1.5 py-0.5 rounded border ${getDivisionColor(f.division)} uppercase text-[8px] font-extrabold`}>
                                            {f.division}
                                        </span>
                                        <span className="text-slate-400">totalplats {f.placement}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER & SHUTDOWN PANEL */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mt-auto pt-4 border-t border-slate-500/10">
                    {/* Left Side: Finish Early button (Stoppa & spara eventet) */}
                    <div className="flex-grow flex items-center justify-start w-full md:w-auto">
                        {!isLobbyMode && (
                            <button 
                                onClick={handleRaceComplete}
                                disabled={isSavingRace}
                                className="bg-red-650 hover:bg-red-600 text-white font-extrabold py-3.5 px-6 rounded-2xl uppercase tracking-wider text-xs shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-[0.98] transition-all w-full md:w-auto"
                            >
                                {isSavingRace ? 'Sparar...' : 'Stoppa & spara eventet'}
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* CONFIRMATION OVERLAYS ACCESSIBLE IN TV VIEW */}
            {showResetConfirmation && <RaceResetConfirmationModal onConfirm={handleConfirmReset} onCancel={() => setShowResetConfirmation(false)} onExit={() => onFinish({ isNatural: false })} />}
            
            {showConfetti && <Confetti />}
            {showFinishAnimation && (
                <RaceFinishAnimation 
                  winnerName={winnerName} 
                  finalRaceId={finalRaceId}
                  onDismiss={() => {
                      setShowFinishAnimation(false);
                      if (finalRaceId) onFinish({ isNatural: true, raceId: finalRaceId });
                  }} 
                />
            )}
            
            <AnimatePresence>
              {isSavingRace && (
                  <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.1 }}
                      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm"
                  >
                      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  </motion.div>
              )}
              {isActuallyPaused && !showFinishAnimation && !isLobbyMode && (
                  <PauseOverlay onResume={() => handleRemoteAction('resume')} onRestart={() => handleRemoteAction('reset')} onFinish={handleExit} />
              )}
              {participantToEdit && (
                  <EditResultModal 
                      participantName={startedParticipants.find(p => p.id === participantToEdit)?.name || participantToEdit}
                      currentTime={finishedParticipants[participantToEdit]?.time || 0}
                      onSave={handleUpdateResult}
                      onAddPenalty={handleAddPenalty}
                      onUndo={handleRemoveResult}
                      onCancel={() => setParticipantToEdit(null)}
                  />
              )}
              {showBackToPrepConfirmation && <RaceBackToPrepConfirmationModal onConfirm={onBackToGroups} onCancel={() => setShowBackToPrepConfirmation(false)} />}
            </AnimatePresence>
        </div>
    );
  };

  // --- HYROX PRESTIGE VIEW RENDERING ---
  if (isHyroxRace) {
      return renderHyroxPremiumView();
  }

  return (
    <div 
        className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 ${showFullScreenColor ? `${timerStyle.bg}` : 'bg-gray-100 dark:bg-black'}`}
        style={{ '--pulse-color-rgb': timerStyle.pulseRgb } as React.CSSProperties}
        onClick={handleInteraction}
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
    >
      {/* NEW BACK BUTTON FOR LOBBY MODE */}
      {/* IMPORTANT: This should be visible if isLobbyMode OR isActuallyFinishedOrIdle */}
      {/* UPDATE: Also visible if paused to allow exit */}
      {(isLobbyMode || isActuallyFinishedOrIdle || isActuallyPaused) && (
          <button
              onClick={handleExit}
              className={`fixed ${navPos === 'bottom' ? 'bottom-8' : 'top-8'} left-8 z-[60] bg-black/20 hover:bg-black/40 text-white backdrop-blur-md px-6 py-3 rounded-full font-bold transition-all flex items-center gap-3 border border-white/10 shadow-lg group`}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>{isActuallyPaused ? 'AVSLUTA' : 'TILLBAKA'}</span>
          </button>
      )}

      {/* LOBBY OVERLAY REMOVED - NOW INTEGRATED INTO CARD */}

      {showConfetti && <Confetti />}
      {showFinishAnimation && (
          <RaceFinishAnimation 
            winnerName={winnerName} 
            finalRaceId={finalRaceId}
            onDismiss={() => {
                setShowFinishAnimation(false);
                if (finalRaceId) onFinish({ isNatural: true, raceId: finalRaceId });
            }} 
          />
      )}
      
      <AnimatePresence>
        {isExiting && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                transition={{ duration: 0.1 }}
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm"
            >
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </motion.div>
        )}
        {isActuallyPaused && !showFinishAnimation && !isLobbyMode && (
            <PauseOverlay onResume={() => handleRemoteAction('resume')} onRestart={() => handleRemoteAction('reset')} onFinish={handleExit} />
        )}
        {participantToEdit && (
            <EditResultModal 
                participantName={startedParticipants.find(p => p.id === participantToEdit)?.name || participantToEdit}
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
        {status !== TimerStatus.Idle && !isActuallyPaused && !showFinishAnimation && !isLobbyMode && (
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute top-10 z-[100]"
                style={{ right: isHyroxRace ? `calc(${HYROX_RIGHT_PANEL_WIDTH} + 2.5rem)` : '2.5rem' }}
            >
                {!isTransitioning && (
                    <BigRoundIndicator 
                        currentRound={currentRound} 
                        totalRounds={totalRounds} 
                        mode={block.settings.mode} 
                        currentInterval={
                            block.settings.mode === TimerMode.Custom ? (completedWorkIntervals % (block.settings.sequence?.length || 1)) + 1 :
                            block?.settings.specifiedLaps != null ? (completedWorkIntervals % (block?.settings.specifiedIntervalsPerLap || block.exercises?.length || 1)) + 1 : 
                            (block?.settings.mode === TimerMode.Interval && block?.settings.specifiedLaps === undefined && block?.settings.rounds && (block.exercises?.length || 0) > 0 && block.settings.rounds % (block.exercises?.length || 1) === 0) ? (completedWorkIntervals % (block.exercises?.length || 1)) + 1 : undefined
                        }
                        totalIntervalsInLap={
                            block.settings.mode === TimerMode.Custom ? block.settings.sequence?.length || 1 :
                            block?.settings.specifiedLaps != null ? (block?.settings.specifiedIntervalsPerLap || block.exercises?.length || 1) : 
                            (block?.settings.mode === TimerMode.Interval && block?.settings.specifiedLaps === undefined && block?.settings.rounds && (block.exercises?.length || 0) > 0 && block.settings.rounds % (block.exercises?.length || 1) === 0) ? (block.exercises?.length || 1) : undefined
                        }
                    />
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN TIMER CARD */}
      <div 
          className={`absolute flex flex-col items-center transition-all duration-500 z-10 left-0 
              ${isHyroxRace ? 'pr-10' : 'right-0'} 
              ${showFullScreenColor 
                  ? `top-[12%] min-h-[50%] justify-center` 
                  : `${isAutostartMode ? (controlsVisible ? 'pt-4 pb-4 min-h-[25%]' : 'pt-4 pb-2 min-h-[20%]') : 'pt-6 pb-6 min-h-[25%]'} top-4 mx-4 sm:mx-6 rounded-[3rem] shadow-2xl ${timerStyle.bg}`
              }`}
          style={{
              ...(!showFullScreenColor ? { '--pulse-color-rgb': timerStyle.pulseRgb } : {}),
              right: isHyroxRace ? HYROX_RIGHT_PANEL_WIDTH : '0px'
          } as React.CSSProperties}
      >
        {/* LOBBY START BUTTON OVERLAY */}
            {isLobbyMode && (
                 <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8">
                     <button 
                        onClick={() => handleRemoteAction('start')}
                        className="bg-white text-black active:scale-110 transition-transform duration-200 rounded-full p-6 shadow-2xl border-4 border-white/50 group"
                     >
                        <PlayIcon className="w-16 h-16 ml-1 fill-current group-active:text-primary transition-colors" />
                     </button>
                 </div>
            )}

            {isAutostartMode ? (
                <div className={`absolute top-4 left-4 sm:top-6 sm:left-6 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 shadow-sm z-20 transition-opacity ${isLobbyMode ? 'opacity-0' : 'opacity-100'}`}>
                    <span className={`font-bold tracking-widest text-white/90 uppercase drop-shadow-sm text-[10px] sm:text-xs`}>{modeLabel}</span>
                </div>
            ) : (
                <div className={`mb-2 px-8 py-1.5 rounded-full bg-black/30 backdrop-blur-xl border border-white/20 shadow-lg z-20 transition-opacity ${isLobbyMode ? 'opacity-0' : 'opacity-100'}`}>
                    <span className={`font-black tracking-[0.3em] text-white uppercase drop-shadow-md text-base md:text-lg`}>{modeLabel}</span>
                </div>
            )}

            {/* STATUS (ARBETE/VILA) ELLER BLOCK RUBRIK - Överst */}
            <div className="text-center z-20 w-full px-10 mb-1">
                {isAutostartMode ? (
                    <h1 className={`font-black text-white/90 uppercase tracking-tighter text-xl sm:text-2xl md:text-3xl drop-shadow-lg overflow-visible whitespace-nowrap leading-none ${isTransitioning ? 'animate-pulse' : ''}`}>
                        {isTransitioning ? "VILA - GÖR REDO" : block.title}
                    </h1>
                ) : (
                    <h2 className={`font-black text-white tracking-widest uppercase drop-shadow-xl animate-pulse w-full text-center text-3xl sm:text-4xl lg:text-5xl overflow-visible whitespace-nowrap leading-none ${isLobbyMode ? 'opacity-100' : ''}`}>
                        {isLobbyMode ? "REDO" : statusLabel}
                    </h2>
                )}
            </div>

            {/* SIFFROR (Tiden) - Mitten */}
            <div className={`z-20 relative flex flex-col items-center w-full text-white transition-opacity duration-300 ${isLobbyMode ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
                <div className="flex items-center justify-center w-full gap-2">
                     <span className="font-mono font-black leading-none tracking-tighter tabular-nums select-none text-[7rem] sm:text-[9rem] md:text-[11rem]">
                        {minutesStr}:{secondsStr}
                     </span>
                </div>
            </div>

            {/* TIDSLINJE (Roadmap) - Under tiden */}
            <div className="w-[80%] max-w-4xl mt-1 mb-1 z-20">
                <SegmentedRoadmap 
                    chain={workoutChain} 
                    currentBlockId={block.id} 
                    totalChainElapsed={totalChainElapsed} 
                    totalChainTime={chainInfo.totalDuration}
                    // Custom Mode props
                    isCustomMode={block.settings.mode === TimerMode.Custom}
                    sequence={block.settings.sequence}
                    currentSegmentIndex={completedWorkIntervals}
                    totalSequenceDuration={totalSequenceDuration}
                    totalSequenceElapsed={totalTimeElapsed}
                />
            </div>

            {/* BLOCK RUBRIK (Stort) - Längst ner (Döljs i AutostartMode) */}
            {!isAutostartMode && (
                <div className="text-center z-20 w-full px-10 mt-2 mb-1">
                    <h1 className="font-black text-white/90 uppercase tracking-tighter text-xl sm:text-2xl md:text-3xl drop-shadow-lg overflow-visible whitespace-nowrap leading-none">
                        {isTransitioning ? nextBlock?.title : block.title}
                    </h1>
                </div>
            )}

        {/* TIMER CONTROLS (Relative under title) */}
        <div className="relative z-50">
            <TimerControls 
                textSizeScale={textSizeScale} 
                repsSizeScale={repsSizeScale} 
                onTextChange={(val) => handleSizeChange('text', val)} 
                onRepsChange={(val) => handleSizeChange('reps', val)} 
                visible={controlsVisible && !isFreestanding}
            />
        </div>
      </div>

      {/* CONTENT AREA (Under Clock) */}
      <div 
          className={`absolute bottom-4 left-0 flex flex-col items-center justify-start z-0 pt-2 transition-all duration-500 px-6
              ${showFullScreenColor ? 'top-[65%]' : (isAutostartMode ? (controlsVisible ? 'top-[26%]' : 'top-[24%]') : 'top-[28%]')} 
              ${isHyroxRace ? '' : 'right-0'}`}
          style={{ right: isHyroxRace ? HYROX_RIGHT_PANEL_WIDTH : '0px' }}
      >
          
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
                                    showDescription={block.showExerciseDescriptions !== false} // PASS THE PROP
                                    textSizeScale={textSizeScale}
                                    repsSizeScale={repsSizeScale}
                                    upcomingText={upcomingText}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    // STANDARD LIST LAYOUT (Side by side if next blocks exist)
                    <div className="flex gap-4 flex-grow items-stretch w-full min-h-0">
                         <div className={`flex flex-col gap-6 transition-all duration-500 h-full min-h-0 w-full mx-auto max-w-6xl`}>
                            {isTransitioning && !isAutostartMode ? (
                                // Header för vila-läget (Döljs i AutostartMode)
                                <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center bg-white/80 dark:bg-black/20 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-lg gap-6">
                                    <div className="flex-1">
                                        <span className="inline-block px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-black uppercase tracking-[0.2em] mb-3">Uppladdning</span>
                                        <h3 className="text-5xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{nextBlock?.title}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Gör er redo för nästa del av passet</p>
                                        {nextBlock?.showDescriptionInTimer && nextBlock?.setupDescription && (
                                            <p className="text-gray-900 dark:text-white text-xl md:text-2xl font-bold leading-tight tracking-tight mt-4 border-t border-gray-200 dark:border-white/10 pt-4">
                                                {nextBlock.setupDescription}
                                            </p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={handleStartNextBlock}
                                        className="bg-gray-900 dark:bg-white text-white dark:text-black font-black py-4 px-10 rounded-2xl shadow-2xl hover:scale-105 transition-all text-lg uppercase tracking-widest border-4 border-gray-700 dark:border-white/30 whitespace-nowrap"
                                    >
                                        Starta nu
                                    </button>
                                </div>
                            ) : (
                                ((!isTransitioning && block.showDescriptionInTimer && block.setupDescription) || 
                                 (isTransitioning && nextBlock?.showDescriptionInTimer && nextBlock?.setupDescription)) && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-8 py-6 bg-white/95 dark:bg-gray-900 border-2 border-primary/20 dark:border-white/10 w-full flex items-center gap-6 shadow-xl rounded-[2.5rem] flex-shrink-0">
                                            <div className="bg-primary/10 p-3 rounded-2xl"><InformationCircleIcon className="w-8 h-8 text-primary shrink-0" /></div>
                                            <p className="text-gray-900 dark:text-white text-2xl md:text-3xl font-black leading-tight tracking-tight">
                                                {isTransitioning ? nextBlock!.setupDescription : block.setupDescription}
                                            </p>
                                    </motion.div>
                                )
                            )}

                            <div className="w-full flex-grow min-h-0"> 
                                {!isFreestanding && (
                                    <div className="flex flex-col gap-8 w-full h-full">
                                        {/* Current Block (or Next Block if transitioning) */}
                                        <div className={`flex-1 min-h-0 ${isAutostartMode && !isTransitioning ? 'opacity-100' : ''}`}>
                                            <StandardListView 
                                                exercises={isTransitioning ? (nextBlock?.exercises || []) : (block.exercises || [])} 
                                                timerStyle={timerStyle} 
                                                isHyrox={isHyroxRace} 
                                                showDescriptions={block.showExerciseDescriptions !== false} // PASS THE PROP
                                                textSizeScale={textSizeScale}
                                                repsSizeScale={repsSizeScale}
                                                status={status}
                                            />
                                        </div>
                                        
                                        {/* Upcoming Block (only in AutostartMode) */}
                                        {isAutostartMode && (
                                            (() => {
                                                const upcomingBlock = isTransitioning ? upcomingBlocks[1] : nextBlock;
                                                if (!upcomingBlock) return null;
                                                return (
                                                    <div className="flex-1 min-h-0 opacity-50 transition-opacity duration-500">
                                                        <div className="mb-4 flex items-center gap-4">
                                                            <div className="h-px bg-gray-300 dark:bg-gray-700 flex-1"></div>
                                                            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">
                                                                Kommande: {upcomingBlock.title}
                                                            </span>
                                                            <div className="h-px bg-gray-300 dark:bg-gray-700 flex-1"></div>
                                                        </div>
                                                        <StandardListView 
                                                            exercises={upcomingBlock.exercises} 
                                                            timerStyle={getTimerStyle(TimerStatus.Idle, upcomingBlock.settings.mode, isHyroxRace, false, null)} 
                                                            isHyrox={isHyroxRace} 
                                                            showDescriptions={false} // Hide descriptions for upcoming
                                                            textSizeScale={textSizeScale * 0.8} // Maybe slightly smaller?
                                                            repsSizeScale={repsSizeScale * 0.8}
                                                            status={TimerStatus.Idle}
                                                        />
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* UPCOMING BLOCKS STACK REMOVED */}
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

      {/* ACTION BAR AT BOTTOM - HIDDEN IN LOBBY */}
      {!isLobbyMode && (
          <div className={`fixed z-50 transition-all duration-500 flex gap-6 left-1/2 -translate-x-1/2 ${showFullScreenColor ? 'top-[65%]' : 'top-[35%]'} ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'} ${isHyroxRace ? 'ml-[-225px]' : ''}`}>
                {isActuallyFinishedOrIdle ? (
                    <>
                        <button onClick={handleExit} className="bg-gray-600/80 text-white font-bold py-4 px-10 rounded-full shadow-xl hover:bg-gray-50 active:scale-95 transition-all text-xl backdrop-blur-md border-2 border-white/20 uppercase" style={{ touchAction: 'manipulation' }}>TILLBAKA</button>
                        <button onClick={() => handleRemoteAction('start')} className="bg-white text-black font-black py-4 px-16 rounded-full shadow-2xl active:scale-95 transition-transform text-xl border-4 border-white/50 uppercase" style={{ touchAction: 'manipulation' }}>STARTA</button>
                    </>
                ) : isActuallyPaused ? (
                    <button onClick={() => handleRemoteAction('resume')} className="bg-green-500 text-white font-bold py-4 px-10 rounded-full shadow-xl border-2 border-green-400 uppercase active:scale-95 transition-transform" style={{ touchAction: 'manipulation' }}>FORTSÄTT</button>
                ) : (
                    <button onClick={() => handleRemoteAction('pause')} className="bg-white text-gray-900 font-black py-4 px-16 rounded-full shadow-2xl active:bg-gray-100 transition-transform active:scale-95 text-xl border-4 border-white/50 uppercase" style={{ touchAction: 'manipulation' }}>PAUSA</button>
                )}
                {isHyroxRace && status !== TimerStatus.Running && <button onClick={() => setShowBackToPrepConfirmation(true)} className="bg-gray-800/80 text-white font-bold py-4 px-8 rounded-full shadow-xl border-2 border-gray-600 hover:bg-gray-700 active:scale-95 transition-all text-lg uppercase" style={{ touchAction: 'manipulation' }}>⚙️ Grupper</button>}
          </div>
      )}
    </div>
  );
};
