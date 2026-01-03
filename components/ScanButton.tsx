
import React, { useState, useRef, useEffect } from 'react';
import { QrCodeIcon, CloseIcon, SearchIcon, ChatBubbleIcon, DumbbellIcon, SparklesIcon, PaperAirplaneIcon, PlusIcon } from './icons';
import { useWorkout } from '../context/WorkoutContext';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AnimatePresence, motion } from 'framer-motion';
import { Workout, WorkoutLog, ChatMessage } from '../types';
import { saveWorkoutLog } from '../services/firebaseService';

// --- Sub-component: WorkoutSearchModal ---
interface WorkoutSearchModalProps {
    onClose: () => void;
    onSelect: (workout: Workout) => void;
    workouts: Workout[];
}

const WorkoutSearchModal: React.FC<WorkoutSearchModalProps> = ({ onClose, onSelect, workouts }) => {
    const [search, setSearch] = useState('');
    
    const filtered = workouts.filter(w => w.title.toLowerCase().includes(search.toLowerCase()) && w.isPublished);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex flex-col p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Sök Pass</h2>
                <button onClick={onClose} className="p-2 bg-gray-800 rounded-full"><CloseIcon className="w-6 h-6 text-white" /></button>
            </div>
            
            <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Sök efter passnamn..."
                className="w-full bg-gray-800 text-white p-4 rounded-xl border border-gray-700 focus:border-primary focus:outline-none mb-6 text-lg"
                autoFocus
            />

            <div className="flex-grow overflow-y-auto space-y-3">
                {filtered.map(w => (
                    <button 
                        key={w.id} 
                        onClick={() => onSelect(w)}
                        className="w-full bg-gray-800 p-4 rounded-xl text-left border border-gray-700 hover:border-primary transition-colors flex justify-between items-center"
                    >
                        <div>
                            <h3 className="font-bold text-white text-lg">{w.title}</h3>
                            <p className="text-gray-400 text-sm">{w.category || 'Okategoriserad'}</p>
                        </div>
                        <span className="text-primary font-semibold">Välj &rarr;</span>
                    </button>
                ))}
                {filtered.length === 0 && <p className="text-center text-gray-500 mt-10">Inga pass hittades.</p>}
            </div>
        </div>
    );
};

// --- Sub-component: MemberChatModal ---
const MemberChatModal: React.FC<{ onClose: () => void; userEmail?: string }> = ({ onClose, userEmail }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initChat = async () => {
            const systemPrompt = `Du är en personlig AI-coach för en medlem på gymmet SmartStudio. Svara alltid kort, peppande och på svenska. Du heter Smart Coach.`;
            setMessages([{ role: 'model', text: `Hej ${userEmail ? userEmail.split('@')[0] : ''}! Jag är din AI-coach. Vad behöver du hjälp med idag?` }]);
        };
        initChat();
    }, [userEmail]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            let apiKey = '';
            if (typeof process !== 'undefined' && process.env?.API_KEY) apiKey = process.env.API_KEY;
            else apiKey = (import.meta as any).env.VITE_API_KEY;

            const ai = new GoogleGenAI({ apiKey });
            const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
            
            const chat = model.startChat({
                history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
            });

            const result = await chat.sendMessageStream(userMsg);
            let fullResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of result.stream) {
                const text = chunk.text();
                fullResponse += text;
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].text = fullResponse;
                    return newMsgs;
                });
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: 'Kunde inte nå servern.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex flex-col p-0 sm:p-6 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-2xl mx-auto rounded-none sm:rounded-3xl border border-gray-700 shadow-2xl flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg"><SparklesIcon className="w-5 h-5 text-purple-400" /></div>
                        <h3 className="font-bold text-white">AI Coach</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full"><CloseIcon className="w-6 h-6 text-gray-400" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="text-gray-500 text-xs ml-4">Skriver...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Fråga coachen..."
                        className="flex-grow bg-gray-900 text-white px-4 py-3 rounded-full border border-gray-700 focus:border-primary focus:outline-none"
                    />
                    <button type="submit" disabled={!input.trim()} className="p-3 bg-primary rounded-full text-white disabled:opacity-50"><PaperAirplaneIcon className="w-5 h-5 rotate-90" /></button>
                </form>
            </div>
        </div>
    );
};

interface ScanButtonProps {
    onScan: () => void;
    onLogWorkout?: (workoutId: string, orgId: string) => void;
}

// --- Main Component: ScanButton ---
export const ScanButton: React.FC<ScanButtonProps> = ({ onLogWorkout }) => {
    const { currentUser } = useAuth();
    const { workouts } = useWorkout();
    const { selectedOrganization } = useStudio();
    
    // View States
    const [view, setView] = useState<'idle' | 'menu' | 'camera' | 'search' | 'chat'>('idle');

    // Camera Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);

    // Camera Logic
    const startCamera = async () => {
        setCameraError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setStream(mediaStream);
            if (videoRef.current) videoRef.current.srcObject = mediaStream;
        } catch (err) {
            console.error("Camera error:", err);
            setCameraError("Kunde inte starta kameran.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    useEffect(() => {
        if (view === 'camera' && !stream) startCamera();
        else if (view !== 'camera' && stream) stopCamera();
    }, [view]);

    useEffect(() => {
        if (view === 'camera' && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [view, stream]);

    // Handlers
    const handleMenuToggle = () => setView(view === 'idle' ? 'menu' : 'idle');
    
    const handleSelectWorkout = (workout: Workout) => {
        if (onLogWorkout && selectedOrganization) {
            onLogWorkout(workout.id, selectedOrganization.id);
            setView('idle');
        }
    };

    // Render Sub-Views
    if (view === 'camera') {
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center p-4">
                <button onClick={() => setView('idle')} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><CloseIcon className="w-8 h-8" /></button>
                <div className="w-full max-w-md bg-black rounded-3xl overflow-hidden relative border-2 border-primary/50 shadow-2xl aspect-[3/4]">
                    {cameraError ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6"><p className="text-red-400 font-bold mb-2">Ops!</p><p className="text-gray-300">{cameraError}</p></div>
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none"><div className="w-full h-full border-2 border-primary/50 relative"></div></div>
                            <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none"><p className="text-white font-bold bg-black/50 inline-block px-4 py-2 rounded-full backdrop-blur-sm">Rikta kameran mot QR-koden</p></div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (view === 'search') return <WorkoutSearchModal onClose={() => setView('idle')} onSelect={handleSelectWorkout} workouts={workouts} />;
    if (view === 'chat') return <MemberChatModal onClose={() => setView('idle')} userEmail={currentUser?.email} />;

    // Render Main FAB Menu
    return (
        <>
            <AnimatePresence>
                {view === 'menu' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
                        onClick={() => setView('idle')}
                    />
                )}
            </AnimatePresence>
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
                <AnimatePresence>
                    {view === 'menu' && (
                        <div className="flex flex-col items-end gap-3 mb-2">
                            {/* Chat Button */}
                            <motion.button
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                transition={{ delay: 0.1 }}
                                onClick={() => setView('chat')}
                                className="flex items-center gap-3 group"
                            >
                                <span className="bg-white text-gray-800 text-xs font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">AI Coach</span>
                                <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg hover:bg-purple-500 transition-colors">
                                    <SparklesIcon className="w-6 h-6" />
                                </div>
                            </motion.button>

                            {/* Search Button */}
                            <motion.button
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                transition={{ delay: 0.05 }}
                                onClick={() => setView('search')}
                                className="flex items-center gap-3 group"
                            >
                                <span className="bg-white text-gray-800 text-xs font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">Sök pass</span>
                                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-500 transition-colors">
                                    <SearchIcon className="w-6 h-6" />
                                </div>
                            </motion.button>

                            {/* Scan Button (Small) */}
                            <motion.button
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                onClick={() => setView('camera')}
                                className="flex items-center gap-3 group"
                            >
                                <span className="bg-white text-gray-800 text-xs font-bold px-2 py-1 rounded shadow-sm whitespace-nowrap">Scanna QR</span>
                                <div className="w-12 h-12 rounded-full bg-gray-700 text-white flex items-center justify-center shadow-lg hover:bg-gray-600 transition-colors">
                                    <QrCodeIcon className="w-6 h-6" />
                                </div>
                            </motion.button>
                        </div>
                    )}
                </AnimatePresence>

                {/* Main Toggle Button */}
                <button
                    onClick={handleMenuToggle}
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${view === 'menu' ? 'bg-gray-200 rotate-45 text-gray-800 shadow-xl' : 'bg-primary hover:scale-110 text-white'}`}
                    aria-label="Öppna meny"
                >
                    <PlusIcon className={`w-10 h-10 transition-transform duration-300 ${view === 'menu' ? 'text-gray-900' : 'text-white'}`} />
                </button>
            </div>
        </>
    );
};
