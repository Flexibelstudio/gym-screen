import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Workout, WorkoutBlock, Exercise, TimerMode } from '../types';

// Data contract from Träningsloggen
type TraningloggenBaseLift = 'Knäböj' | 'Bänkpress' | 'Marklyft' | 'Axelpress' | 'Chins / Pullups' | 'Frontböj' | 'Clean' | 'Bulgarian Split Squat' | 'RDL' | 'Farmer’s Walk' | 'Snatch Grip Deadlift' | 'Clean & Press' | 'Push Press' | 'Hantelrodd' | 'Goblet Squat' | 'Thrusters' | 'Stående Rodd';
type TraningloggenMetric = 'reps' | 'weight' | 'distance' | 'duration' | 'calories';

// Simple map to find baselifts from exercise names
const baseLiftMap: { [key: string]: TraningloggenBaseLift } = {
    'knäböj': 'Knäböj',
    'squat': 'Knäböj',
    'bänkpress': 'Bänkpress',
    'bench press': 'Bänkpress',
    'marklyft': 'Marklyft',
    'deadlift': 'Marklyft',
    'axelpress': 'Axelpress',
    'shoulder press': 'Axelpress',
    'ohp': 'Axelpress',
    'chins': 'Chins / Pullups',
    'pullups': 'Chins / Pullups',
    'frontböj': 'Frontböj',
    'front squat': 'Frontböj',
    'clean': 'Clean',
    'bulgarian split squat': 'Bulgarian Split Squat',
    'rdl': 'RDL',
    "romanian deadlift": 'RDL',
    'farmer’s walk': 'Farmer’s Walk',
    'farmers walk': 'Farmer’s Walk',
    'snatch grip deadlift': 'Snatch Grip Deadlift',
    'clean & press': 'Clean & Press',
    'push press': 'Push Press',
    'hantelrodd': 'Hantelrodd',
    'dumbbell row': 'Hantelrodd',
    'goblet squat': 'Goblet Squat',
    'thruster': 'Thrusters',
    'stående rodd': 'Stående Rodd',
    'barbell row': 'Stående Rodd',
};

const getBaseLiftType = (exerciseName: string): TraningloggenBaseLift | undefined => {
    const lowerCaseName = exerciseName.toLowerCase();
    for (const key in baseLiftMap) {
        if (lowerCaseName.includes(key)) {
            return baseLiftMap[key];
        }
    }
    return undefined;
};

const getLoggableMetrics = (block: WorkoutBlock, exercise: Exercise): TraningloggenMetric[] => {
    const metrics = new Set<TraningloggenMetric>();
    const lowerCaseName = exercise.name.toLowerCase();
    const lowerCaseReps = (exercise.reps || '').toLowerCase();

    // Log reps if the reps field is filled, or it's an AMRAP/EMOM style workout where reps are counted.
    if (lowerCaseReps || [TimerMode.AMRAP, TimerMode.EMOM, TimerMode.NoTimer, TimerMode.TimeCap].includes(block.settings.mode)) {
        metrics.add('reps');
    }

    // Check for weight-based exercises by excluding common bodyweight ones.
    const bodyweightKeywords = ['burpee', 'push-up', 'sit-up', 'armhävning', 'plank', 'jumping jack', 'walkout', 'chins', 'pull-up', 'höga knän', 'armcirklar', 'katt', 'ko', 'pendling', 'stretch'];
    const isLikelyBodyweight = bodyweightKeywords.some(kw => lowerCaseName.includes(kw));
    
    if (!isLikelyBodyweight) {
        metrics.add('weight');
    }

    // Check for cardio machine metrics
    if (lowerCaseName.includes('rodd') || lowerCaseName.includes('row') || lowerCaseName.includes('ski') || lowerCaseName.includes('airbike') || lowerCaseName.includes('löpning') || lowerCaseName.includes('run')) {
        metrics.add('distance');
        metrics.add('calories');
        metrics.add('duration');
    }
     
    // If no specific metrics are identified, provide a sensible default.
    if (metrics.size === 0) return ['reps', 'weight'];

    return Array.from(metrics);
};


export const transformWorkoutForQr = (workout: Workout): string => {
  const tlWorkout = {
    title: workout.title,
    blocks: workout.blocks.map(block => {
      return {
        name: block.title,
        exercises: block.exercises.map(ex => {
          return {
            name: ex.name,
            sets: block.settings.rounds,
            reps: ex.reps || '',
            baseLiftType: getBaseLiftType(ex.name),
            loggableMetrics: getLoggableMetrics(block, ex),
          };
        })
      };
    })
  };

  const jsonString = JSON.stringify(tlWorkout);
  return jsonString;
};


interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workout: Workout | null;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, workout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && workout && canvasRef.current) {
      const qrData = transformWorkoutForQr(workout);
      QRCode.toCanvas(canvasRef.current, qrData, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }, (error) => {
        if (error) console.error('QR Code Generation Error:', error);
      });
    }
  }, [isOpen, workout]);

  if (!isOpen || !workout) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-center text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-2">Logga passet i Träningsloggen</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Scanna QR-koden med din andra app för att ladda in övningarna för <strong className="text-primary">{`"${workout.title}"`}</strong>.</p>
        <div className="bg-white p-4 rounded-lg inline-block">
          <canvas ref={canvasRef} />
        </div>
        <button onClick={onClose} className="mt-8 w-full bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">
          Stäng
        </button>
      </div>
    </div>
  );
};
