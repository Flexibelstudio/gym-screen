
import React, { useState, useMemo, useCallback } from 'react';
import { BankExercise, Exercise, Organization } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { DumbbellIcon, TrashIcon } from '../icons';

interface ExerciseBankPanelProps {
    bank: BankExercise[];
    onAddExercise: (exercise: BankExercise) => void;
    onPreviewExercise: (exercise: BankExercise) => void;
    onDeleteExercise?: (exercise: BankExercise) => Promise<void>; // New prop
    isLoading: boolean;
}

export const ExerciseBankPanel: React.FC<ExerciseBankPanelProps> = ({ bank, onAddExercise, onPreviewExercise, onDeleteExercise, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { selectedOrganization } = useStudio();
    
    // We use the 'bank' prop directly now, no local state needed for the list itself if parent manages it.
    // However, for filtering performance or immediate feedback if parent doesn't update fast enough, we can just rely on props.
    
    const handleDeleteClick = async (e: React.MouseEvent, exercise: BankExercise) => {
        e.stopPropagation();
        if (onDeleteExercise) {
            if (window.confirm(`Vill du ta bort "${exercise.name}" från din lokala övningsbank?`)) {
                await onDeleteExercise(exercise);
            }
        }
    };

    const filteredBank = useMemo(() => {
        if (!searchTerm) return bank;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return bank.filter(ex => 
            ex.name.toLowerCase().includes(lowerCaseSearchTerm) ||
            (ex.description && ex.description.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (ex.tags && ex.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm)))
        );
    }, [bank, searchTerm]);

    return (
        <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 flex flex-col max-h-[60vh]">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex-shrink-0">Övningsbank</h3>
            <div className="mb-4 flex-shrink-0">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Sök övning, muskelgrupp..."
                    className="w-full bg-white dark:bg-black p-2 rounded-md border border-slate-300 dark:border-gray-600 focus:ring-1 focus:ring-primary focus:outline-none"
                />
            </div>
            <div className="flex-grow overflow-y-auto pr-2 space-y-3">
                {isLoading ? (
                    <p className="text-center text-gray-500">Laddar banken...</p>
                ) : (
                    filteredBank.map(ex => {
                        const isCustom = ex.organizationId || ex.id.startsWith('custom_');

                        return (
                            <div key={ex.id} className="bg-white dark:bg-gray-900/70 rounded-md p-2 flex items-center gap-3 relative group">
                                <div 
                                    className="flex-grow min-w-0 flex items-center gap-3 cursor-pointer"
                                    onClick={() => onPreviewExercise(ex)}
                                    role="button"
                                    aria-label={`Förhandsgranska ${ex.name}`}
                                >
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-gray-900 dark:text-white truncate">{ex.name}</p>
                                            {isCustom && (
                                                <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                                                    Egen
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ex.description}</p>
                                    </div>
                                </div>
                                
                                {isCustom && onDeleteExercise && (
                                    <button
                                        onClick={(e) => handleDeleteClick(e, ex)}
                                        className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Ta bort egen övning"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                )}

                                <button 
                                    onClick={() => onAddExercise(ex)} 
                                    className="bg-primary/20 hover:bg-primary/40 text-primary font-bold w-10 h-10 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
                                    title={`Lägg till ${ex.name}`}
                                    aria-label={`Lägg till ${ex.name} i passet`}
                                >
                                    <span className="text-2xl">+</span>
                                </button>
                            </div>
                        )
                    })
                )}
                 {filteredBank.length === 0 && !isLoading && <p className="text-center text-gray-500 py-4">Inga övningar matchade sökningen.</p>}
            </div>
        </div>
    );
};

export const ExercisePreviewModal: React.FC<{
    exercise: BankExercise | null;
    onClose: () => void;
    onAdd: (exercise: BankExercise) => void;
}> = ({ exercise, onClose, onAdd }) => {
    
    if (!exercise) return null;
    
    const handleAdd = () => {
        onAdd(exercise);
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1001] p-4 animate-fade-in" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exercise-preview-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-shrink-0 flex justify-between items-start mb-4">
                     <h3 id="exercise-preview-title" className="text-2xl font-bold text-primary">{exercise.name}</h3>
                     <button onClick={onClose} className="font-bold text-2xl leading-none text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" aria-label="Stäng">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <p className="text-base text-gray-700 dark:text-gray-300">{exercise.description}</p>
                    {exercise.tags && exercise.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {exercise.tags.map(tag => (
                                <span key={tag} className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full">{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-6 flex-shrink-0 flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">Stäng</button>
                    <button onClick={handleAdd} className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">Lägg till i passet</button>
                </div>
            </div>
        </div>
    );
};
