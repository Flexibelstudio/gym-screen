
import React, { useState, useRef, useEffect } from 'react';
import { Workout } from '../../types';
import { SparklesIcon } from '../icons';
import { chatWithAICoach } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    suggestedExercises?: { name: string; description: string }[];
}

const DraggableSuggestedExercise: React.FC<{ exercise: { name: string; description: string } }> = ({ exercise }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `ai-${exercise.name}`,
        data: {
            type: 'ai-suggestion',
            exercise: {
                name: exercise.name,
                description: exercise.description,
                isFromBank: false,
                loggingEnabled: false
            }
        }
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`w-full text-left bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-2 flex items-center justify-between cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
        >
            <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{exercise.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{exercise.description}</p>
            </div>
        </div>
    );
};

export const AICoachSidebar: React.FC<{
    workout: Workout;
    onAnalyze: () => Promise<void>;
    onUpdateWorkout: (workout: Workout) => void;
    availableExercises: string[];
}> = ({ workout, onAnalyze, onUpdateWorkout, availableExercises }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory, isAnalyzing, isChatting]);

    const handleAnalyzeClick = async () => {
        setIsAnalyzing(true);
        try {
            await onAnalyze();
            // Add a welcome message from the coach if it's the first interaction
            if (chatHistory.length === 0) {
                setChatHistory([{
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: "Jag har analyserat ditt pass! Kolla in mina tips ovan. Har du några frågor eller vill du att jag ändrar något åt dig? Säg bara till!"
                }]);
            }
        } catch (error) {
            console.error("Analysis failed", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isChatting) return;

        const userText = chatInput.trim();
        setChatInput('');
        
        const newUserMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText
        };
        
        const newHistory = [...chatHistory, newUserMsg];
        setChatHistory(newHistory);
        setIsChatting(true);

        try {
            // Map to the format expected by the service
            const apiHistory = newHistory.map(msg => ({ role: msg.role, content: msg.content }));
            
            const response = await chatWithAICoach(workout, apiHistory, userText, availableExercises);
            
            if (response.updatedWorkout) {
                onUpdateWorkout(response.updatedWorkout);
            }

            setChatHistory(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.replyText,
                suggestedExercises: response.suggestedExercises
            }]);

        } catch (error) {
            console.error("Chat failed", error);
            setChatHistory(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Tyvärr stötte jag på ett problem. Kan du försöka igen?"
            }]);
        } finally {
            setIsChatting(false);
        }
    };

    const hasSummary = !!workout.aiCoachSummary;
    const hasSuggestions = workout.blocks?.some(b => 
        (b.aiMagicPenSuggestions && b.aiMagicPenSuggestions.length > 0) || b.aiCoachNotes
    );

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Chat Container (History + Input) */}
            <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-shrink-0">
                {/* Chat History */}
                <div className="max-h-80 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 scrollbar-hide">
                    {chatHistory.length === 0 && !isChatting ? (
                        <div className="text-center py-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Ställ en fråga om passet, be om övningstips eller be mig byta ut övningar!
                            </p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {chatHistory.map((msg) => (
                                <motion.div 
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                >
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                                        msg.role === 'user' 
                                            ? 'bg-purple-600 text-white rounded-tr-sm' 
                                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm'
                                    }`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        
                                        {/* Suggested Exercises Buttons */}
                                        {msg.suggestedExercises && msg.suggestedExercises.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Förslag:</p>
                                                {msg.suggestedExercises.map((ex, i) => (
                                                    <DraggableSuggestedExercise key={i} exercise={ex} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {isChatting && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-start"
                                >
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-4 flex gap-1.5 shadow-sm">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <form onSubmit={handleSendMessage} className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Fråga AI:n eller be den ändra passet..."
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-4 pr-12 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow"
                            disabled={isChatting || isAnalyzing}
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isChatting || isAnalyzing}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                        AI:n kan uppdatera passet åt dig. Granska alltid ändringarna.
                    </p>
                </div>
            </div>

            {/* Analyze Button */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <button 
                    onClick={handleAnalyzeClick} 
                    disabled={isAnalyzing}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                >
                    {isAnalyzing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <SparklesIcon className="w-5 h-5" />
                    )}
                    <span>{isAnalyzing ? 'Analyserar...' : 'Analysera passet'}</span>
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                    Klicka här för att få feedback på dina ändringar utan att AI:n byter ut dina övningar.
                </p>
            </div>

            {/* Scrollable area for Summary & Suggestions */}
            <div className="flex-grow overflow-y-auto space-y-6 pb-4 scrollbar-hide">
                {/* AI Summary */}
                {hasSummary && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl p-6 shadow-sm border border-purple-100 dark:border-gray-700 relative overflow-hidden">
                        <h3 className="text-lg font-bold text-purple-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-2xl">🤖</span>
                            <span>AI-Coach Summering</span>
                        </h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {workout.aiCoachSummary}
                        </p>
                    </div>
                )}

                {/* Block Suggestions */}
                {hasSuggestions && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-xl p-6 shadow-sm border border-yellow-200 dark:border-yellow-900/30">
                        <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2">
                            <span className="text-2xl">✨</span>
                            <span>Tips & Förbättringar</span>
                        </h3>
                        <div className="space-y-6">
                            {workout.blocks.map(block => {
                                const hasNotes = !!block.aiCoachNotes;
                                const hasMagic = block.aiMagicPenSuggestions && block.aiMagicPenSuggestions.length > 0;
                                
                                if (!hasNotes && !hasMagic) return null;

                                return (
                                    <div key={block.id} className="space-y-2">
                                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm border-b border-yellow-200 dark:border-yellow-800 pb-1">
                                            {block.title}
                                        </h4>
                                        
                                        {/* Coach Notes (Analysis) */}
                                        {hasNotes && (
                                            <div className="p-2 bg-white/50 dark:bg-black/20 rounded-md">
                                                <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{block.aiCoachNotes}"</p>
                                            </div>
                                        )}

                                        {/* Magic Pen Suggestions (Actionable) */}
                                        {hasMagic && (
                                            <ul className="space-y-1.5 pt-1">
                                                {block.aiMagicPenSuggestions!.map((sugg, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-gray-800 dark:text-gray-200">
                                                        <span className="text-yellow-600 dark:text-yellow-400 mt-0.5 font-bold">→</span>
                                                        <span>{sugg}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {!hasSummary && !hasSuggestions && !isAnalyzing && (
                    <div className="text-center p-8 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700 border-dashed">
                        <p className="text-gray-500 dark:text-gray-400">Klicka på "Analysera passet" för att få feedback.</p>
                    </div>
                )}
            </div>
        </div>
    );
};