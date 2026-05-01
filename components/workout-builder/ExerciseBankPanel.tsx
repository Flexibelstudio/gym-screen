
import React, { useState, useMemo, useCallback } from 'react';
import { BankExercise, Exercise, Organization } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { DumbbellIcon, TrashIcon, PencilIcon, CheckIcon, CloseIcon } from '../icons';
import { useDraggable } from '@dnd-kit/core';
import { useConfirm } from '../ConfirmContext';

interface ExerciseBankPanelProps {
    bank: BankExercise[];
    onPreviewExercise: (exercise: BankExercise) => void;
    onDeleteExercise?: (exercise: BankExercise) => Promise<void>;
    onEditExercise?: (exercise: BankExercise, newName: string) => Promise<void>;
    isLoading: boolean;
}

const DraggableBankExercise: React.FC<{
    exercise: BankExercise;
    onPreview: (ex: BankExercise) => void;
    onDelete?: (e: React.MouseEvent, ex: BankExercise) => void;
    onEdit?: (ex: BankExercise, newName: string) => Promise<void>;
}> = ({ exercise, onPreview, onDelete, onEdit }) => {
    const isCustom = exercise.organizationId || exercise.id.startsWith('custom_');
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(exercise.name);
    const [isSaving, setIsSaving] = useState(false);
    
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `bank-${exercise.id}`,
        data: {
            type: 'bank-exercise',
            exercise: {
                name: exercise.name,
                description: exercise.description,
                imageUrl: exercise.imageUrl,
                isFromBank: true,
                id: exercise.id, // Keep the bank ID
                loggingEnabled: true
            }
        },
        disabled: isEditing,
    });

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!editName.trim() || editName.trim() === exercise.name || !onEdit) {
            setIsEditing(false);
            setEditName(exercise.name);
            return;
        }
        setIsSaving(true);
        await onEdit(exercise, editName.trim());
        setIsSaving(false);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-white dark:bg-gray-900/70 rounded-md p-2 flex items-center gap-2 border border-primary/50">
                <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-grow bg-white dark:bg-black p-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-primary"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave(e as any);
                        if (e.key === 'Escape') {
                            setIsEditing(false);
                            setEditName(exercise.name);
                        }
                    }}
                />
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                >
                    <CheckIcon className="w-4 h-4" />
                </button>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(false);
                        setEditName(exercise.name);
                    }} 
                    disabled={isSaving}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div 
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`bg-white dark:bg-gray-900/70 rounded-md p-2 flex items-center gap-3 relative group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
        >
            <div 
                className="flex-grow min-w-0 flex items-center gap-3"
                onClick={(e) => {
                    if (!isDragging && !isEditing) {
                        onPreview(exercise);
                    }
                }}
                role="button"
                aria-label={`Förhandsgranska ${exercise.name}`}
            >
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{exercise.name}</p>
                        {isCustom && (
                            <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                                Egen
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{exercise.description}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isCustom && onEdit && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary transition-colors focus:opacity-100"
                        title="Redigera namn"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>
                )}
                {isCustom && onDelete && (
                    <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(e, exercise);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors focus:opacity-100"
                        title="Ta bort egen övning"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

export const ExerciseBankPanel: React.FC<ExerciseBankPanelProps> = ({ bank, onPreviewExercise, onDeleteExercise, onEditExercise, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const { selectedOrganization } = useStudio();
    const { confirm } = useConfirm();
    
    // We use the 'bank' prop directly now, no local state needed for the list itself if parent manages it.
    // However, for filtering performance or immediate feedback if parent doesn't update fast enough, we can just rely on props.
    
    const handleDeleteClick = async (e: React.MouseEvent, exercise: BankExercise) => {
        e.stopPropagation();
        if (onDeleteExercise) {
            const isConfirmed = await confirm({
                title: 'Ta bort övning?',
                message: `Vill du ta bort "${exercise.name}" från din lokala övningsbank?`,
                confirmText: 'Ta bort',
                confirmColor: 'red'
            });
            if (isConfirmed) {
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
        <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 flex flex-col h-full">
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
                    filteredBank.map(ex => (
                        <DraggableBankExercise 
                            key={ex.id} 
                            exercise={ex} 
                            onPreview={onPreviewExercise} 
                            onDelete={onDeleteExercise ? handleDeleteClick : undefined} 
                            onEdit={onEditExercise}
                        />
                    ))
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
