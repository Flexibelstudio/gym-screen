import React, { useState } from 'react';
import { startProgramData } from '../data/startProgramData';
import type { StartProgramSession, ProgramSection, ProgramExercise, ProgramFinisher } from '../types';

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const LogIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
     </svg>
);


const SectionCard: React.FC<{ section: ProgramSection }> = ({ section }) => (
    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700/50">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{section.title}</h3>
        <ul className="space-y-3">
            {section.points.map((point, index) => (
                <li key={index} className="flex items-start gap-3">
                    {section.icon === 'check' && <CheckIcon />}
                    {section.icon === 'log' && <LogIcon />}
                    <span className="text-gray-700 dark:text-gray-300">{point}</span>
                </li>
            ))}
        </ul>
    </div>
);

const TrainingCard: React.FC<{ training: StartProgramSession['content']['training'] }> = ({ training }) => (
     <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700/50">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{training.title}</h3>
        {training.description && <p className="text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-wrap">{training.description}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {training.exercises.map((ex, index) => (
                <ExerciseCard key={index} exercise={ex} />
            ))}
        </div>
    </div>
);

const ExerciseCard: React.FC<{ exercise: ProgramExercise }> = ({ exercise }) => (
    <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-5">
        <h4 className="text-lg font-bold text-primary">{exercise.name}</h4>
        <p className="text-gray-600 dark:text-gray-400 font-semibold mb-3">{exercise.details}</p>
        <ul className="space-y-2 list-disc list-inside">
            {exercise.notes.map((note, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300">{note}</li>
            ))}
        </ul>
    </div>
);

const FinisherCard: React.FC<{ finisher: ProgramFinisher }> = ({ finisher }) => (
    <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700/50">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{finisher.title}</h3>
        {finisher.details && <p className="text-gray-600 dark:text-gray-400 mb-4">{finisher.details}</p>}
        <ul className="space-y-2 list-disc list-inside">
            {finisher.points.map((point, index) => (
                <li key={index} className="text-gray-700 dark:text-gray-300">{point}</li>
            ))}
        </ul>
    </div>
);


export const StartProgramScreen: React.FC = () => {
    const [activeSessionId, setActiveSessionId] = useState<string>(startProgramData[0].id);

    const activeSession = startProgramData.find(s => s.id === activeSessionId);

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in">
            {/* Session Tabs */}
            <div className="mb-8 p-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-around gap-2">
                {startProgramData.map(session => (
                    <button
                        key={session.id}
                        onClick={() => setActiveSessionId(session.id)}
                        className={`w-full py-2.5 rounded-md text-lg font-bold transition-colors duration-300 ${activeSessionId === session.id ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
                    >
                        {session.shortTitle}
                    </button>
                ))}
            </div>

            {/* Session Content */}
            {activeSession && (
                <div className="space-y-6 animate-fade-in">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">{activeSession.title}</h2>

                    {activeSession.content.sections.map((section, index) => (
                        <SectionCard key={index} section={section} />
                    ))}

                    <TrainingCard training={activeSession.content.training} />
                    
                    {activeSession.content.finisher && (
                        <FinisherCard finisher={activeSession.content.finisher} />
                    )}
                </div>
            )}
        </div>
    );
};
