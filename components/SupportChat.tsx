
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from '../types';
import { QuestionMarkCircleIcon, PaperAirplaneIcon, CloseIcon } from './icons';

/**
 * A component that safely renders a string as basic Markdown HTML.
 * It supports bold text (**text**) and unordered lists (* item).
 */
const ChatMessageContent: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = () => {
        if (!content) return { __html: '' };

        // 1. Escape basic HTML to prevent injection from the model.
        let safeContent = content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 2. Process Markdown line by line for better structure.
        const lines = safeContent.split('\n');
        const htmlElements: string[] = [];
        let inList = false;

        const closeListIfNeeded = () => {
            if (inList) {
                htmlElements.push('</ul>');
                inList = false;
            }
        };

        for (const line of lines) {
            // Apply inline formats like bold
            let processedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em>$1</em>');

            if (processedLine.trim().startsWith('* ')) {
                if (!inList) {
                    // Start a new list
                    htmlElements.push('<ul class="list-disc list-inside space-y-1 pl-4">');
                    inList = true;
                }
                // Add the list item, removing the leading '* '
                htmlElements.push(`<li>${processedLine.trim().substring(2)}</li>`);
            } else {
                closeListIfNeeded();
                if (processedLine.trim() !== '') {
                    // Wrap non-list lines that have content in <p> tags
                    htmlElements.push(`<p>${processedLine}</p>`);
                }
            }
        }
        
        closeListIfNeeded(); // Ensure any open list is closed at the end.

        return { __html: htmlElements.join('') };
    };

    return (
        <div 
            // Using Tailwind's typography plugin for clean default styling of rendered HTML.
            className="text-base prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1" 
            dangerouslySetInnerHTML={renderMarkdown()} 
        />
    );
};


export function SupportChat(): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && !chat) {
            const systemKnowledge = `
Du är Smart Support, en expert på systemet "Smart Skärm". Du hjälper coacher och administratörer att använda plattformen. Svara kortfattat, trevligt och på svenska.

Här är din kunskapsbas om hur systemet fungerar:

**1. PASSBYGGAREN & AI**
* **Skapa pass:** Man kan bygga pass manuellt block för block, eller använda AI.
* **AI-Generator:** Coachen kan skriva "Gör ett benpass" så skapar AI:n ett komplett upplägg.
* **Tolka Text/Bild:** Man kan klistra in text eller ladda upp en bild på en handskriven tavla, så konverterar systemet det till ett digitalt pass.
* **Följ mig-läge:** I passbyggaren kan man aktivera "Följ mig". På: Alla gör samma övning samtidigt. Av: Stationsbaserad cirkelträning.
* **AI Coach Feedback:** När man bygger pass kan man klicka på "Analysera". Då ger AI:n tips på förbättringar (balans, flås, etc.) och "Magic Pen"-förslag för specifika justeringar.

**2. IDÉ-TAVLAN (Whiteboard)**
* Detta är en digital rityta där man kan skissa fritt.
* **Unik funktion:** Man kan klicka "Skapa Pass" inne i Idé-tavlan. Då läser AI:n av det du ritat/skrivit och skapar ett riktigt träningspass.
* Man kan också spara sina skisser i ett arkiv.

**3. TIMER-LÄGEN**
* **Intervall:** Arbete/Vila (t.ex. 40s/20s). Man kan ställa in antal varv.
* **Tabata:** En klassiker. 20s jobb, 10s vila, 8 ronder.
* **EMOM:** "Every Minute On the Minute". Startar en ny rond varje minut.
* **AMRAP:** "As Many Rounds As Possible". En nedräkningstimern på en fast tid.
* **Time Cap:** Liknar AMRAP men används ofta för "For Time"-pass där man ska bli klar inom tiden.
* **Stoppur:** Räknar uppåt.

**4. HYROX-MODULEN**
* Ett specialläge för att köra HYROX-pass eller simulera tävlingar.
* **Startgrupper:** Man kan lägga till deltagare i olika startgrupper som startar med t.ex. 2 minuters mellanrum.
* **Resultat:** Man kan registrera tider för deltagare när de går i mål. Systemet skapar automatiskt en topplista (Guld, Silver, Brons).

**5. ÖVNINGSBANKEN**
* Det finns en global bank med hundratals övningar.
* **AI-bilder:** Om en övning saknar bild kan man generera en ny bild med AI direkt i systemet.
* **Egna bilder:** Man kan ladda upp egna bilder eller filma/fota direkt.

**6. SKYLTFÖNSTER & INFO**
* **Skyltfönster:** Digitala anslagstavlor som kan visas på skärmarna när de inte används för pass. Kan innehålla bilder, video eller text.
* **Info-karusell:** En rullande banner i botten på hemskärmen för nyheter.

**7. ROLLER**
* **Coach:** Kan skapa pass, starta timers, använda Idé-tavlan.
* **Admin:** Kan dessutom hantera studios, logotyper, färger och prenumerationer.

Om användaren frågar om något tekniskt fel, be dem ladda om sidan eller kontakta hej@smartskarm.se om problemet kvarstår.
            `;

            // VIKTIGT: Vi försöker hämta nyckeln från båda ställena för att stödja både
            // AI Studio (process.env) och Vite/Produktion (import.meta.env)
            let apiKey = '';
            try {
                if (typeof process !== 'undefined' && process.env?.API_KEY) {
                    apiKey = process.env.API_KEY;
                }
            } catch (e) {
                // Ignore error if process is not defined
            }

            if (!apiKey) {
                // Fallback to Vite env var
                apiKey = (import.meta as any).env.VITE_API_KEY;
            }
            
            if (!apiKey) {
                console.error("Support Chat: Missing API Key (checked both process.env and import.meta.env)");
                setMessages([{
                    role: 'model',
                    text: 'Ursäkta, jag kan inte ansluta just nu (API-nyckel saknas). Kontakta en administratör.'
                }]);
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            // Using gemini-3-flash-preview as requested for AI Studio compatibility
            const newChat = ai.chats.create({
                model: 'gemini-3-flash-preview', 
                config: {
                    systemInstruction: systemKnowledge,
                },
            });
            setChat(newChat);
            setMessages([{
                role: 'model',
                text: 'Hej! Jag är Smart Support. Jag kan allt om passbyggaren, HYROX, Idé-tavlan och timers. Vad funderar du på?'
            }]);
        }
    }, [isOpen, chat]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const userInput = input.trim();
        if (isLoading || !userInput || !chat) return;

        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'user', text: userInput }]);
        setInput('');

        try {
            const response = await chat.sendMessageStream({ message: userInput });
            
            let modelResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);
            
            for await (const chunk of response) {
                // Type assertion for cleaner TS
                const c = chunk as GenerateContentResponse;
                modelResponse += c.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Error sending message to Gemini:", error);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = "Ursäkta, något gick fel. Försök igen.";
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-teal-500 hover:bg-teal-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 z-50"
                aria-label="Öppna hjälp & support"
            >
                <QuestionMarkCircleIcon className="w-9 h-9" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-end justify-center sm:items-center p-4">
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg h-[80vh] flex flex-col transition-transform transform animate-fade-in"
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hjälp & Support</h2>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white" aria-label="Stäng chatt">
                                <CloseIcon className="w-7 h-7" />
                            </button>
                        </div>
                        
                        {/* Messages */}
                        <div className="flex-grow p-4 overflow-y-auto space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'model' && (
                                        <div className="w-8 h-8 rounded-full bg-teal-500 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm">AI</div>
                                    )}
                                    <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-gray-600 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                                        <ChatMessageContent content={msg.text} />
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-8 h-8 rounded-full bg-teal-500 flex-shrink-0 flex items-center justify-center font-bold text-white text-sm">AI</div>
                                    <div className="max-w-[80%] p-3 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none">
                                        <div className="flex gap-1.5 items-center">
                                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
                                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="flex-shrink-0 flex items-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ställ din fråga här..."
                                disabled={isLoading}
                                className="w-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-gray-500 hover:bg-gray-600 text-white p-3 rounded-lg transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                                aria-label="Skicka meddelande"
                            >
                                <PaperAirplaneIcon className="w-6 h-6 transform rotate-90" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}