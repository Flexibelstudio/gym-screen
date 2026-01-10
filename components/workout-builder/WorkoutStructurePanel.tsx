
import React, { useState } from 'react';
import { Workout } from '../../types';

interface WorkoutStructurePanelProps {
    workout: Workout;
    onBlockClick: (blockId: string) => void;
    onExerciseClick: (exerciseId: string) => void;
    dragItemRef: React.MutableRefObject<any>;
    dragOverItemRef: React.MutableRefObject<any>;
    onSort: () => void;
    focusedBlockId: string | null;
}

export const WorkoutStructurePanel: React.FC<WorkoutStructurePanelProps> = ({ workout, onBlockClick, onExerciseClick, dragItemRef, dragOverItemRef, onSort, focusedBlockId }) => {
    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});

    const toggleCollapse = (blockId: string) => {
        setCollapsedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
    };

    return (
        <div className="sticky top-8">
            <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Passets Struktur</h3>
                <div className="space-y-2">
                    {workout.blocks.map((block, blockIndex) => {
                        const isCollapsed = collapsedBlocks[block.id];
                        return (
                            <div 
                                key={block.id}
                                className={`bg-white dark:bg-gray-900/70 rounded-md p-3 transition-all border ${focusedBlockId === block.id ? 'border-primary shadow-sm' : 'border-transparent'}`}
                                onDragEnter={() => {
                                    if(dragItemRef.current?.type === 'exercise' && dragItemRef.current.blockId !== block.id) {
                                      // If dragging an exercise over a new block, target the end of that block's exercise list
                                      dragOverItemRef.current = { type: 'exercise', index: block.exercises.length, blockId: block.id };
                                    }
                                }}
                            >
                                <div 
                                    className="flex items-start gap-2 cursor-grab"
                                    draggable
                                    onDragStart={() => dragItemRef.current = { type: 'block', index: blockIndex }}
                                    onDragEnter={() => dragOverItemRef.current = { type: 'block', index: blockIndex }}
                                    onDragEnd={onSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white mt-1">☰</span>
                                    <div className="flex-grow min-w-0" onClick={() => onBlockClick(block.id)}>
                                        <p className="font-semibold text-gray-900 dark:text-white break-words leading-tight mb-1">{block.title || 'Namnlöst block'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{block.exercises.length} övning(ar)</p>
                                    </div>
                                    <button onClick={() => toggleCollapse(block.id)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white flex-shrink-0">
                                        {isCollapsed ? '▼' : '▲'}
                                    </button>
                                </div>
                                {!isCollapsed && (
                                    <div className="pl-6 pt-3 space-y-1">
                                        {block.exercises.map((ex, exIndex) => (
                                            <div 
                                                key={ex.id} 
                                                className="flex items-start gap-2 text-sm p-1.5 rounded hover:bg-slate-200 dark:hover:bg-gray-700 cursor-grab transition-colors"
                                                draggable
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    dragItemRef.current = { type: 'exercise', index: exIndex, blockId: block.id };
                                                }}
                                                onDragEnter={(e) => {
                                                    e.stopPropagation();
                                                    dragOverItemRef.current = { type: 'exercise', index: exIndex, blockId: block.id };
                                                }}
                                                onDragEnd={(e) => { e.stopPropagation(); onSort(); }}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            >
                                                <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white mt-0.5">☰</span>
                                                <p className="text-gray-700 dark:text-gray-300 flex-grow break-words leading-snug" onClick={() => onExerciseClick(ex.id)}>{ex.name || 'Namnlös övning'}</p>
                                            </div>
                                        ))}
                                        {block.exercises.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Inga övningar</p>}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};
