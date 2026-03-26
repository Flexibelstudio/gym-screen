
import React from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, DumbbellIcon, BuildingIcon, ClockIcon, UsersIcon, ChevronDownIcon } from './icons';

interface LandingPageProps {
    onLoginClick: () => void;
    onRegisterGymClick?: () => void;
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

const FloatingScreens = () => (
    <div className="relative h-[350px] md:h-[450px] w-full max-w-lg mx-auto">
        {/* Startsidan (Back Left) */}
        <motion.div 
            animate={{ y: [0, -15, 0] }} 
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 top-4 w-48 md:w-56 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden opacity-80 transform -rotate-6 origin-bottom-right"
        >
            <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                <div className="w-8 h-8 bg-primary/20 rounded-full mb-3"></div>
                <div className="w-24 h-3 bg-gray-600 rounded-full mb-2"></div>
                <div className="w-32 h-4 bg-gray-400 rounded-full"></div>
            </div>
            <div className="p-4 space-y-3">
                <div className="w-full h-12 bg-gray-800 rounded-xl flex items-center px-3 gap-3">
                    <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
                    <div className="w-20 h-2 bg-gray-600 rounded-full"></div>
                </div>
                <div className="w-full h-12 bg-gray-800 rounded-xl flex items-center px-3 gap-3">
                    <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
                    <div className="w-16 h-2 bg-gray-600 rounded-full"></div>
                </div>
                <div className="w-full h-12 bg-gray-800 rounded-xl flex items-center px-3 gap-3">
                    <div className="w-6 h-6 bg-gray-700 rounded-md"></div>
                    <div className="w-24 h-2 bg-gray-600 rounded-full"></div>
                </div>
            </div>
        </motion.div>

        {/* Fristående Timer (Back Right) */}
        <motion.div 
            animate={{ y: [0, 15, 0] }} 
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute right-0 bottom-4 w-48 md:w-56 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden opacity-80 transform rotate-6 origin-bottom-left"
        >
            <div className="p-6 text-center mt-4">
                <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full mb-4">TABATA</div>
                <div className="text-4xl md:text-5xl font-mono font-black text-white mb-6 tracking-tighter">04:00</div>
                <div className="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
                </div>
            </div>
        </motion.div>

        {/* Timer i pass (Center Front) */}
        <motion.div 
            animate={{ y: [0, -10, 0] }} 
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute z-10 left-1/2 transform -translate-x-1/2 top-1/2 -translate-y-1/2 w-56 md:w-64 bg-gray-900 rounded-2xl border border-gray-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        >
            <div className="bg-gray-800 p-5 text-center border-b border-gray-700">
                <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Dagens WOD</div>
                <div className="text-4xl font-mono font-black text-primary tracking-tighter">12:45</div>
            </div>
            <div className="p-4 space-y-2 bg-gray-900">
                <div className="bg-primary/10 border border-primary/30 p-3 rounded-xl flex justify-between items-center">
                    <div>
                        <div className="text-white font-bold text-sm">1. Burpees</div>
                        <div className="text-primary text-xs mt-1 font-mono">15 reps</div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    </div>
                </div>
                <div className="bg-gray-800 p-3 rounded-xl opacity-60 flex justify-between items-center">
                    <div>
                        <div className="text-white font-bold text-sm">2. Box Jumps</div>
                        <div className="text-gray-400 text-xs mt-1 font-mono">15 reps</div>
                    </div>
                </div>
                <div className="bg-gray-800 p-3 rounded-xl opacity-40 flex justify-between items-center">
                    <div>
                        <div className="text-white font-bold text-sm">3. KB Swings</div>
                        <div className="text-gray-400 text-xs mt-1 font-mono">20 reps</div>
                    </div>
                </div>
            </div>
        </motion.div>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterGymClick }) => {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-primary selection:text-white overflow-x-hidden">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/favicon.png" alt="SmartSkärm Logo" className="w-8 h-8 rounded-lg" referrerPolicy="no-referrer" />
                        <span className="text-xl font-bold tracking-tight">SmartSkärm</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onLoginClick} className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                            Logga in
                        </button>
                        <button onClick={onRegisterGymClick || onLoginClick} className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors">
                            Kom igång
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }}></div>
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
                                <button onClick={onRegisterGymClick || onLoginClick} className="bg-primary hover:bg-teal-400 text-black text-lg px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)]">
                                    Starta din studio
                                </button>
                                <button 
                                    onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                                    className="px-8 py-4 rounded-full font-bold border border-white/20 hover:bg-white/5 transition-colors"
                                >
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
                        <FloatingScreens />
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-black relative">
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
                        <img src="/favicon.png" alt="SmartSkärm Logo" className="w-6 h-6 rounded-md" referrerPolicy="no-referrer" />
                        <span className="font-bold text-lg">SmartSkärm</span>
                    </div>
                    <div className="text-gray-500 text-sm">
                        © 2026 SmartSkärm AB. Alla rättigheter förbehållna.
                    </div>
                </div>
            </footer>
        </div>
    );
};
