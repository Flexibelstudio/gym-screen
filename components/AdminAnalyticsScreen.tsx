import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SparklesIcon, ChartBarIcon, PaperAirplaneIcon, LightningIcon, FireIcon, UsersIcon, ClockIcon, HeartIcon, DumbbellIcon, CloseIcon } from './icons';
import { useStudio } from '../context/StudioContext';
import { getOrganizationLogs } from '../services/firebaseService';
import { WorkoutLog } from '../types';
import { askAdminAnalytics, generateBusinessActions } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';

const ChatMessageContent: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = () => {
        if (!content) return { __html: '' };
        let safeContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
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
            let processedLine = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em>$1</em>');

            if (processedLine.trim().startsWith('* ') || processedLine.trim().startsWith('- ')) {
                if (!inList) {
                    htmlElements.push('<ul class="list-disc list-inside space-y-1 pl-4 my-2">');
                    inList = true;
                }
                htmlElements.push(`<li>${processedLine.trim().substring(2)}</li>`);
            } else if (processedLine.startsWith('### ')) {
                closeListIfNeeded();
                htmlElements.push(`<h4 class="text-lg font-bold mt-4 mb-2">${processedLine.substring(4)}</h4>`);
            } else if (processedLine.startsWith('**') && processedLine.endsWith('**')) {
                 closeListIfNeeded();
                 htmlElements.push(`<p class="font-bold mt-2">${processedLine.replace(/\*\*/g, '')}</p>`);
            } else {
                closeListIfNeeded();
                if (processedLine.trim() !== '') {
                    htmlElements.push(`<p class="mb-2">${processedLine}</p>`);
                }
            }
        }
        closeListIfNeeded();
        return { __html: htmlElements.join('') };
    };

    return <div className="text-sm md:text-base text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={renderMarkdown()} />;
};

const InsightCard: React.FC<{ 
    title: string; 
    value: string | number; 
    sub: string; 
    icon: React.ReactNode; 
    gradient: string; 
    extra?: React.ReactNode;
}> = ({ title, value, sub, icon, gradient, extra }) => (
    <div className={`relative overflow-hidden rounded-3xl p-6 ${gradient} text-white shadow-lg transition-transform hover:scale-[1.02]`}>
        <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between mb-4">
                <p className="font-black text-white/80 text-[10px] uppercase tracking-widest">{title}</p>
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm shadow-inner">
                    {icon}
                </div>
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <p className="text-3xl lg:text-4xl font-black tracking-tight mb-1 truncate">{value}</p>
                    {extra}
                </div>
                <p className="text-xs font-bold text-white/70">{sub}</p>
            </div>
        </div>
        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
    </div>
);

// --- Sentiment Analysis Widget ---

const SentimentDashboard: React.FC<{ logs: WorkoutLog[], onDayClick: (date: string, dayLogs: WorkoutLog[]) => void }> = ({ logs, onDayClick }) => {
    
    const getTagCategory = (tag: string) => {
        const lower = tag.toLowerCase();
        if (['pigg', 'stark', 'bra musik', 'bra pepp', 'grymt pass'].some(k => lower.includes(k))) return 'positive';
        if (['seg', 'stel', 'ont', 'stressad', 'trött'].some(k => lower.includes(k))) return 'negative';
        return 'neutral';
    };

    const { tagCounts, dailyStats } = useMemo(() => {
        const counts: Record<string, number> = {};
        const daily: Record<string, { date: Date, tags: string[], dayLogs: WorkoutLog[] }> = {};

        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            daily[dateKey] = { date: d, tags: [], dayLogs: [] };
        }

        logs.forEach(log => {
            const dateKey = new Date(log.date).toISOString().split('T')[0];
            if (daily[dateKey]) {
                daily[dateKey].dayLogs.push(log);
                if (log.tags) {
                    log.tags.forEach(tag => {
                        counts[tag] = (counts[tag] || 0) + 1;
                        daily[dateKey].tags.push(tag);
                    });
                }
            }
        });

        return { tagCounts: counts, dailyStats: Object.values(daily) };
    }, [logs]);

    const sortedTags = Object.entries(tagCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
    const positiveTags = sortedTags.filter(([t]) => getTagCategory(t) === 'positive');
    const negativeTags = sortedTags.filter(([t]) => getTagCategory(t) === 'negative');

    const getDominantTagForDay = (tags: string[]) => {
        if (tags.length === 0) return null;
        const dayCounts: Record<string, number> = {};
        tags.forEach(t => dayCounts[t] = (dayCounts[t] || 0) + 1);
        return Object.entries(dayCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-2xl">
                    <HeartIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Atmosfär & Mående</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Vad säger medlemmarna om passen?</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Topp Vibbar (Positivt)</h4>
                        <div className="space-y-2">
                            {positiveTags.length > 0 ? positiveTags.slice(0, 4).map(([tag, count], i) => (
                                <div key={tag} className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 w-4">#{i+1}</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{tag}</span>
                                    </div>
                                    <span className="text-xs font-black bg-white dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-lg shadow-sm">
                                        {count} st
                                    </span>
                                </div>
                            )) : <p className="text-sm text-gray-400 italic">Ingen data än.</p>}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Utmaningar (Att hålla koll på)</h4>
                        <div className="space-y-2">
                            {negativeTags.length > 0 ? negativeTags.slice(0, 4).map(([tag, count], i) => (
                                <div key={tag} className="flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 w-4">#{i+1}</span>
                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{tag}</span>
                                    </div>
                                    <span className="text-xs font-black bg-white dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-lg shadow-sm">
                                        {count} st
                                    </span>
                                </div>
                            )) : <p className="text-sm text-gray-400 italic">Inga negativa rapporter.</p>}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/50">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Senaste 14 dagarna</h4>
                        <div className="flex gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-[10px] text-gray-400">Bra</span>
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span><span className="text-[10px] text-gray-400">Mindre bra</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {dailyStats.map(({ date, tags, dayLogs }, i) => {
                            const dateKey = date.toISOString().split('T')[0];
                            const dominant = getDominantTagForDay(tags);
                            const category = dominant ? getTagCategory(dominant) : 'neutral';
                            const count = dayLogs.length;
                            
                            let colorClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400';
                            if (count > 0) {
                                if (category === 'positive') colorClass = 'bg-green-500 text-white border-green-600 shadow-md shadow-green-500/20';
                                else if (category === 'negative') colorClass = 'bg-orange-500 text-white border-orange-600 shadow-md shadow-orange-500/20';
                                else colorClass = 'bg-blue-500 text-white border-blue-600 shadow-md shadow-blue-500/20';
                            }

                            return (
                                <button 
                                    key={i} 
                                    onClick={() => onDayClick(dateKey, dayLogs)}
                                    className={`group relative p-3 rounded-2xl border flex flex-col justify-between aspect-square transition-all hover:scale-105 active:scale-95 ${colorClass}`}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${count > 0 ? 'opacity-80' : 'opacity-50'}`}>
                                        {date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric' })}
                                    </span>
                                    <div className="mt-1">
                                        {dominant ? (
                                            <p className="text-[10px] font-black truncate leading-tight" title={dominant}>
                                                "{dominant}"
                                            </p>
                                        ) : (
                                            <div className="h-1 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                        )}
                                    </div>
                                    {count > 0 && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity flex items-center justify-center">
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Detaljer</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminAnalyticsScreen: React.FC = () => {
  const { selectedOrganization } = useStudio();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Modal State for Day Analysis
  const [selectedDay, setSelectedDay] = useState<{ date: string, logs: WorkoutLog[] } | null>(null);

  useEffect(() => {
    if (selectedOrganization) {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const data = await getOrganizationLogs(selectedOrganization.id, 200);
                setLogs(data);
            } catch (e) {
                console.error("Failed to fetch logs", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLogs();
    }
  }, [selectedOrganization]);

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const insights = useMemo(() => {
      if (logs.length === 0) return null;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const todayCount = logs.filter(l => new Date(l.date).toISOString().split('T')[0] === todayStr).length;

      const workoutCounts: Record<string, number> = {};
      logs.forEach(l => { workoutCounts[l.workoutTitle] = (workoutCounts[l.workoutTitle] || 0) + 1; });
      const sortedWorkouts = Object.entries(workoutCounts).sort((a, b) => (b[1] as number) - (a[1] as number));
      const mostPopular = sortedWorkouts.length > 0 ? sortedWorkouts[0] : ['-', 0];

      const uniqueMembers = new Set(logs.map(l => l.memberId)).size;

      const hours: Record<number, number> = {};
      logs.forEach(l => {
          const h = new Date(l.date).getHours();
          hours[h] = (hours[h] || 0) + 1;
      });
      const peakHourEntry = Object.entries(hours).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
      const peakHour = peakHourEntry ? `${peakHourEntry[0]}:00` : '-';

      return { todayCount, mostPopular: { title: mostPopular[0], count: mostPopular[1] }, activeMembers: uniqueMembers, peakHour };
  }, [logs]);

  const handleChatSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isChatLoading) return;
      const userQuestion = chatInput;
      setChatInput('');
      setChatHistory(prev => [...prev, { role: 'user', text: userQuestion }]);
      setIsChatLoading(true);
      try {
          const response = await askAdminAnalytics(userQuestion, logs);
          setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
      } catch (error) {
          setChatHistory(prev => [...prev, { role: 'ai', text: "Ett fel uppstod. Försök igen." }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleGenerateActions = async () => {
      if (isChatLoading) return;
      setIsChatLoading(true);
      setChatHistory(prev => [...prev, { role: 'user', text: "Ge mig 3 snabba förslag på åtgärder." }]);
      try {
          const response = await generateBusinessActions(logs);
          setChatHistory(prev => [...prev, { role: 'ai', text: response }]);
      } catch (error) {
          setChatHistory(prev => [...prev, { role: 'ai', text: "Kunde inte generera åtgärder just nu." }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleDayClick = (date: string, dayLogs: WorkoutLog[]) => {
      setSelectedDay({ date, logs: dayLogs });
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
        <div>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Analys & Trender</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                Driv beslut med data från {logs.length} loggade pass.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InsightCard 
                title="Loggade Idag" 
                value={insights?.todayCount || 0} 
                sub="Pass genomförda"
                icon={<FireIcon className="w-6 h-6 text-white" />}
                gradient="bg-gradient-to-br from-orange-500 to-red-600"
            />
            <InsightCard 
                title="Favoritpasset" 
                value={insights?.mostPopular.title || '-'} 
                sub={`${insights?.mostPopular.count || 0} loggningar`}
                icon={<ChartBarIcon className="w-6 h-6 text-white" />}
                gradient="bg-gradient-to-br from-purple-600 to-indigo-700"
            />
            <InsightCard 
                title="Aktiva Medlemmar" 
                value={insights?.activeMembers || 0} 
                sub="Unika personer"
                icon={<UsersIcon className="w-6 h-6 text-white" />}
                gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            />
            <InsightCard 
                title="Topp-timmen" 
                value={insights?.peakHour ? `Kl. ${insights.peakHour}` : '-'} 
                sub="Tid då flest loggar pass"
                icon={<ClockIcon className="w-6 h-6 text-white" />}
                gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
                extra={insights?.peakHour !== '-' && (
                    <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-widest self-center">Maxtryck</span>
                )}
            />
        </div>

        <SentimentDashboard logs={logs} onDayClick={handleDayClick} />

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/30 overflow-hidden flex flex-col h-[600px] shadow-xl">
             <div className="p-6 border-b border-indigo-100 dark:border-indigo-800/30 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                        <SparklesIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">AI Dataanalytiker</h3>
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">Ställ frågor om din data</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleGenerateActions}
                    disabled={isChatLoading}
                    className="bg-white dark:bg-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-200 font-bold py-3 px-6 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                >
                    <LightningIcon className="w-4 h-4 text-yellow-500" />
                    <span>Förslag på åtgärder</span>
                </button>
             </div>
             
             <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-white/30 dark:bg-gray-900/30">
                {chatHistory.length === 0 && (
                    <div className="text-center mt-10 opacity-60">
                        <ChartBarIcon className="w-16 h-16 mx-auto text-indigo-300 mb-4" />
                        <p className="text-indigo-800 dark:text-indigo-200 font-medium">Prova att fråga:</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            <button onClick={() => setChatInput("Vad tycker folk om musiken?")} className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:bg-indigo-50 border border-indigo-100 transition-transform hover:-translate-y-0.5">"Gillar de musiken?"</button>
                            <button onClick={() => setChatInput("Hur är stämningen generellt?")} className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:bg-indigo-50 border border-indigo-100 transition-transform hover:-translate-y-0.5">"Hur är stämningen?"</button>
                            <button onClick={() => setChatInput("Sammanfatta kommentarerna")} className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:bg-indigo-50 border border-indigo-100 transition-transform hover:-translate-y-0.5">"Sammanfatta kommentarer"</button>
                        </div>
                    </div>
                )}
                {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 border border-indigo-50 dark:border-gray-700 rounded-bl-none'}`}>
                            {msg.role === 'ai' ? <ChatMessageContent content={msg.text} /> : <p className="font-medium">{msg.text}</p>}
                        </div>
                    </div>
                ))}
                {isChatLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-2 items-center border border-indigo-50 dark:border-gray-700">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
             </div>

             <div className="p-4 bg-white dark:bg-gray-900 border-t border-indigo-100 dark:border-gray-800">
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Skriv din fråga här..." 
                        className="flex-grow bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white font-medium"
                        disabled={isChatLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isChatLoading}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-xl disabled:opacity-50 transition-colors shadow-md"
                    >
                        <PaperAirplaneIcon className="w-6 h-6 rotate-90" />
                    </button>
                </form>
             </div>
        </div>

        {/* Day Analysis Modal */}
        <AnimatePresence>
            {selectedDay && (
                <Modal 
                    isOpen={true} 
                    onClose={() => setSelectedDay(null)} 
                    title={`Dagsanalys: ${new Date(selectedDay.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                    size="2xl"
                >
                    <div className="space-y-8">
                        {/* Day Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Loggade pass</p>
                                <p className="text-4xl font-black text-gray-900 dark:text-white">{selectedDay.logs.length}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Snitt-RPE</p>
                                <p className="text-4xl font-black text-primary">
                                    {(selectedDay.logs.reduce((acc, l) => acc + (l.rpe || 0), 0) / (selectedDay.logs.filter(l => l.rpe).length || 1)).toFixed(1)}
                                </p>
                            </div>
                        </div>

                        {/* Vibb Breakdown */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 ml-1">Dagens Vibbar</h4>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(selectedDay.logs.flatMap(l => l.tags || []))).map(tag => (
                                    <span key={tag} className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-wide border border-primary/20">
                                        {tag}
                                    </span>
                                ))}
                                {selectedDay.logs.every(l => !l.tags || l.tags.length === 0) && (
                                    <p className="text-sm text-gray-400 italic px-1">Inga taggar lämnades denna dag.</p>
                                )}
                            </div>
                        </div>

                        {/* Comments List */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 ml-1">Medlemsröster</h4>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedDay.logs.filter(l => l.comment).length > 0 ? (
                                    selectedDay.logs.filter(l => l.comment).map(log => (
                                        <div key={log.id} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                    {log.memberName?.[0] || '?'}
                                                </div>
                                                <span className="text-xs font-bold text-gray-900 dark:text-white">{log.memberName || 'Anonym medlem'}</span>
                                                {log.feeling && <span className="text-xs ml-auto">{log.feeling === 'good' ? '🔥' : log.feeling === 'bad' ? '🤕' : '🙂'}</span>}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">
                                                "{log.comment}"
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-10 text-center bg-gray-50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-100 dark:border-gray-800">
                                        <p className="text-sm text-gray-400 italic">Inga kommentarer lämnades denna dag.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button 
                            onClick={() => setSelectedDay(null)}
                            className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
                        >
                            Stäng dagsanalys
                        </button>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    </div>
  );
};