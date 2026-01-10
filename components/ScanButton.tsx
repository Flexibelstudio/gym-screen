
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { ChatMessage } from '../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { SparklesIcon, CloseIcon, PaperAirplaneIcon, QrCodeIcon, DumbbellIcon, PlusIcon, SearchIcon } from './icons';

// --- Sub-component: MemberChatModal ---
const MemberChatModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { userData, currentUser } = useAuth();
    const { studioConfig, selectedOrganization } = useStudio();
    
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Determine user name
    const userName = userData?.firstName || currentUser?.email?.split('@')[0] || 'Medlem';
    const gymName = selectedOrganization?.name || 'Gymmet';

    useEffect(() => {
        const initChat = async () => {
            setMessages([{ 
                role: 'model', 
                text: `Tjena ${userName}! Jag är din PT i fickformat. Vad kör vi idag?` 
            }]);
        };
        initChat();
    }, [userName]);

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
            
            // Build the system instruction based on Admin settings
            let systemPrompt = `Du är en hjälpsam och peppande PT och coach för medlemmar på gymmet "${gymName}".
            
            Dina svar ska vara:
            1. Korta och koncisa (max 2-3 meningar per råd).
            2. Rakt på sak. Undvik långa inledningar som "Vad spännande att du vill..." eller "Som din AI-assistent...".
            3. Tydligt formaterade. Använd punktlistor om du ger flera råd.

            VIKTIGA REGLER FÖR FORMATERING:
            - Använd ALDRIG stjärnor (**) runt namn på personer, gymmet eller platser. Skriv bara namnet som vanlig text.
            - Använd inte emojis i överflöd, max 1-2 per svar.

            Hantering av frågor:
            - Om en användare frågar om träning: Ge ett konkret, direkt tips.
            - Om en användare verkar omotiverad: Ge en kort, kraftfull "push".
            - Om en medlem frågar om specifika skador: Ge ett generellt svar men rekommendera kort att prata med personalen på plats.
            - Språk: Svenska.
            `;

            // Append Admin customizations if they exist
            if (studioConfig?.aiSettings?.instructions) {
                systemPrompt += `\n\nVIKTIGA INSTRUKTIONER FRÅN GYMMET (DESSA SKA PRIORITERAS HÖGT):\n${studioConfig.aiSettings.instructions}`;
            }

            if (studioConfig?.aiSettings?.tone) {
                const toneMap: Record<string, string> = {
                    'neutral': 'Neutral och professionell.',
                    'enthusiastic': 'Peppande, energisk och entusiastisk! Använd utropstecken.',
                    'strict': 'Sträng, rakt på sak och militärisk. Inget daltande.',
                    'sales': 'Säljande, serviceinriktad och inbjudande.'
                };
                const toneDesc = toneMap[studioConfig.aiSettings.tone] || studioConfig.aiSettings.tone;
                systemPrompt += `\n\nTONLÄGE: Du ska vara ${toneDesc}`;
            }

            const chat = ai.chats.create({
                model: 'gemini-3-flash-preview',
                config: {
                    systemInstruction: systemPrompt
                }
            });

            const result = await chat.sendMessageStream({ message: userMsg });
            let fullResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of result) {
                const text = (chunk as GenerateContentResponse).text;
                fullResponse += text;
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].text = fullResponse;
                    return newMsgs;
                });
            }
        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: 'Kunde inte nå servern. Försök igen om en stund.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-white/80 dark:bg-black/90 backdrop-blur-sm z-[2000] flex flex-col p-0 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl mx-auto rounded-none sm:rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg"><SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Coach Assistent</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Drivs av AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><CloseIcon className="w-6 h-6 text-gray-400" /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-900">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-primary text-white rounded-br-none' 
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-50 dark:border-gray-700'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="text-gray-400 dark:text-gray-500 text-xs ml-4 animate-pulse">Tänker...</div>}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Fråga om träning eller övningar..."
                        className="flex-grow bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-3 rounded-full border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none shadow-inner"
                    />
                    <button type="submit" disabled={!input.trim()} className="p-3 bg-primary rounded-full text-white disabled:opacity-50 shadow-md active:scale-90 transition-transform"><PaperAirplaneIcon className="w-5 h-5 rotate-90" /></button>
                </form>
            </div>
        </div>
    );
};

interface ScanButtonProps {
    onScan: () => void;
    onLogWorkout: (workoutId: string, orgId: string) => void;
    onSearch: () => void;
}

export const ScanButton: React.FC<ScanButtonProps> = ({ onScan, onLogWorkout, onSearch }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const { selectedOrganization } = useStudio();

    if (showChat) {
        return <MemberChatModal onClose={() => setShowChat(false)} />;
    }

    const handleManualLog = () => {
        setIsOpen(false);
        if (selectedOrganization) {
            onLogWorkout('MANUAL_ENTRY', selectedOrganization.id);
        }
    };

    return (
        <>
            {/* Backdrop Overlay to dim content */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-40 animate-fade-in"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="relative flex flex-col items-end gap-3 z-50">
                {isOpen && (
                    <>
                        <button 
                            onClick={() => { setIsOpen(false); setShowChat(true); }}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full text-purple-600 dark:text-purple-400">
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Fråga Coach</span>
                        </button>

                        <button 
                            onClick={() => { setIsOpen(false); onScan(); }}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-full text-teal-600 dark:text-teal-400">
                                <QrCodeIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Scanna QR-kod</span>
                        </button>

                        <button 
                            onClick={() => { setIsOpen(false); onSearch(); }}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
                                <SearchIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Söka Pass</span>
                        </button>

                        <button 
                            onClick={handleManualLog}
                            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 rounded-full shadow-lg flex items-center gap-3 pr-6 transition-all hover:scale-105 border border-gray-100 dark:border-gray-700"
                        >
                            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-600 dark:text-gray-300">
                                <DumbbellIcon className="w-5 h-5" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">Logga Annan Aktivitet</span>
                        </button>
                    </>
                )}
                
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${isOpen ? 'bg-gray-800 dark:bg-gray-700 text-white rotate-45' : 'bg-primary text-white hover:scale-110 hover:brightness-110'}`}
                >
                    {isOpen ? <CloseIcon className="w-6 h-6" /> : <PlusIcon className="w-7 h-7" />}
                </button>
            </div>
        </>
    );
};
