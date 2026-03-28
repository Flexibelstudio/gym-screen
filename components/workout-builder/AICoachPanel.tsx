
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
    onUpdateWorkout: (workout: Workout) => void;
    availableExercises: string[];
}> = ({ workout, onUpdateWorkout, availableExercises }) => {
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
    }, [chatHistory, isChatting]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isChatting) return;

        const userText = text.trim();
        
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

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = chatInput;
        setChatInput('');
        await sendMessage(text);
    };

    const handleQuickAction = (text: string) => {
        sendMessage(text);
    };

    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Chat Container (History + Input) */}
            <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-purple-100 dark:border-purple-900/50 overflow-hidden shadow-sm flex-grow">
                {/* Chat History */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-purple-50/50 dark:bg-purple-900/10 scrollbar-hide">
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
                <div className="p-3 border-t border-purple-100 dark:border-purple-900/50 bg-white dark:bg-gray-800 flex flex-col gap-3">
                    {/* Quick Actions */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        <button
                            type="button"
                            onClick={() => handleQuickAction("Analysera passet")}
                            disabled={isChatting}
                            className="whitespace-nowrap px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors disabled:opacity-50"
                        >
                            Analysera passet
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickAction("Ge mig tips & förbättringar")}
                            disabled={isChatting}
                            className="whitespace-nowrap px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm rounded-full hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors disabled:opacity-50"
                        >
                            Ge mig tips & förbättringar
                        </button>
                    </div>
                    
                    <form onSubmit={handleSendMessage} className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Fråga AI:n eller be den ändra passet..."
                            className="w-full bg-purple-50/50 dark:bg-gray-900 border border-purple-200 dark:border-purple-800/50 rounded-xl pl-4 pr-12 py-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-shadow"
                            disabled={isChatting}
                        />
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isChatting}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </button>
                    </form>
                    <p className="text-[10px] text-gray-400 text-center mt-1">
                        AI:n kan uppdatera passet åt dig. Granska alltid ändringarna.
                    </p>
                </div>
            </div>
        </div>
    );
};