
import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, DumbbellIcon, BuildingIcon, ClockIcon, UsersIcon, ChevronDownIcon } from './icons';

interface LandingPageProps {
    onLoginClick: () => void;
}

const FeatureCard: React.FC<{ title: string; desc: string; icon: React.ReactNode; delay: number }> = ({ title, desc, icon, delay }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.5 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-8 rounded-3xl hover:border-primary/50 transition-colors group"
    >
        <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400 leading-relaxed">
            {desc}
        </p>
    </motion.div>
);

const MockScreen = () => (
    <div className="relative mx-auto border-gray-800 bg-gray-900 border-[8px] rounded-t-xl h-[172px] max-w-[301px] md:h-[294px] md:max-w-[512px]">
        <div className="rounded-lg overflow-hidden h-[156px] md:h-[278px] bg-gray-800 relative">
            {/* Mock UI Content */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black p-4 flex flex-col items-center justify-center">
                <div className="flex gap-2 mb-4">
                    <div className="w-20 h-6 bg-gray-700 rounded-full animate-pulse"></div>
                    <div className="w-12 h-6 bg-primary/20 rounded-full"></div>
                </div>
                <div className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-2xl font-mono mb-2">
                    12:45
                </div>
                <div className="w-full bg-gray-700/50 rounded-full h-2 mt-4 overflow-hidden">
                    <div className="bg-primary h-full w-2/3"></div>
                </div>
                <div className="mt-4 flex gap-4">
                    <div className="w-24 h-24 bg-gray-800 rounded-xl border border-gray-700 flex flex-col items-center justify-center p-2">
                        <span className="text-2xl">💪</span>
                        <div className="h-2 w-12 bg-gray-600 rounded mt-2"></div>
                    </div>
                    <div className="w-24 h-24 bg-gray-800 rounded-xl border border-primary/50 flex flex-col items-center justify-center p-2 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/10 animate-pulse"></div>
                        <span className="text-2xl text-primary font-bold">WOD</span>
                    </div>
                </div>
            </div>
        </div>
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-3 bg-gray-800 rounded-b-xl"></div>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-primary selection:text-white overflow-x-hidden">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-tr from-primary to-teal-600 rounded-lg"></div>
                        <span className="text-xl font-bold tracking-tight">SmartSkärm</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onLoginClick} className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                            Logga in
                        </button>
                        <button onClick={onLoginClick} className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors">
                            Kom igång
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
                    <div className="text-center lg:text-left">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-block py-1 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-6">
                                Det kompletta operativsystemet för gym
                            </span>
                            <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-none mb-6">
                                Förvandla din <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-200">
                                    Digitala Yta.
                                </span>
                            </h1>
                            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                SmartSkärm är allt-i-ett-plattformen för gym och studios. Hantera infoskärmar, skapa AI-drivna träningspass och kör professionella timers – allt från en plats.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <button onClick={onLoginClick} className="bg-primary hover:bg-teal-400 text-black text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)]">
                                    Starta din studio
                                </button>
                                <button className="px-8 py-4 rounded-full font-bold border border-white/20 hover:bg-white/5 transition-colors">
                                    Se funktioner
                                </button>
                            </div>
                        </motion.div>
                    </div>
                    
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <MockScreen />
                        {/* Floating elements */}
                        <motion.div 
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -right-4 top-20 bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-xl"
                        >
                            <SparklesIcon className="w-8 h-8 text-purple-400 mb-2" />
                            <p className="text-xs text-gray-400 font-bold">AI Coach</p>
                            <p className="text-xs text-white">Analys klar</p>
                        </motion.div>
                        <motion.div 
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -left-8 bottom-20 bg-gray-800 p-4 rounded-2xl border border-gray-700 shadow-xl"
                        >
                            <ClockIcon className="w-8 h-8 text-green-400 mb-2" />
                            <p className="text-xs text-gray-400 font-bold">HYROX Timer</p>
                            <p className="text-xs text-white">Startgrupp 1: 00:00</p>
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-black relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">Ett system. Oändliga möjligheter.</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Byggt för boxägare, personliga tränare och gymkedjor som vill modernisera sin upplevelse.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard 
                            title="AI Passbyggare" 
                            desc="Skapa balanserade och varierade träningspass på sekunder med hjälp av vår integrerade Gemini AI-coach."
                            icon={<SparklesIcon className="w-8 h-8" />}
                            delay={0.1}
                        />
                        <FeatureCard 
                            title="Professionella Timers" 
                            desc="Tabata, EMOM, AMRAP eller HYROX-läge. Synkroniserade timers som ser fantastiska ut på storbildsskärm."
                            icon={<ClockIcon className="w-8 h-8" />}
                            delay={0.2}
                        />
                        <FeatureCard 
                            title="Digital Skyltning" 
                            desc="Förvandla dina skärmar till digitala anslagstavlor när de inte används för träning. Schemalägg info enkelt."
                            icon={<BuildingIcon className="w-8 h-8" />}
                            delay={0.3}
                        />
                        <FeatureCard 
                            title="Övningsbank" 
                            desc="Hundratals inbyggda övningar med möjlighet att ladda upp egna bilder eller generera dem med AI."
                            icon={<DumbbellIcon className="w-8 h-8" />}
                            delay={0.4}
                        />
                        <FeatureCard 
                            title="Idé-tavlan" 
                            desc="Digital whiteboard för att skissa upp pass för hand, som sedan tolkas automatiskt till digitala pass."
                            icon={<span className="text-2xl">✏️</span>}
                            delay={0.5}
                        />
                        <FeatureCard 
                            title="Teamhantering" 
                            desc="Ge dina coacher rätt verktyg och behörigheter. Hantera flera studios från ett konto."
                            icon={<UsersIcon className="w-8 h-8" />}
                            delay={0.6}
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-12 bg-black">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary rounded-md"></div>
                        <span className="font-bold text-lg">SmartSkärm</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                        © 2025 SmartSkärm AB. Alla rättigheter förbehållna.
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="text-gray-400 hover:text-primary transition-colors">Support</a>
                        <a href="#" className="text-gray-400 hover:text-primary transition-colors">Integritet</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
