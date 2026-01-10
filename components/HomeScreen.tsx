
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, Workout, MenuItem, StudioConfig, Passkategori, CustomCategoryWithPrompt } from '../types';
import { welcomeMessages } from '../data/welcomeMessages';
import { motion, AnimatePresence } from 'framer-motion';
import { DumbbellIcon, SparklesIcon, StarIcon, PencilIcon, DocumentTextIcon, getIconComponent } from './icons';
import { WeeklyPBList } from './WeeklyPBList'; 
import { CommunityFeed } from './CommunityFeed'; // Import new component

// --- Icons for Menu Cards ---
const TimerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HyroxIcon = () => (
  <span className="text-2xl font-black tracking-tighter">HX</span>
);

const getIconForCategory = (category: CustomCategoryWithPrompt) => {
    // Priority 1: Configured Icon
    if (category.icon) {
        const IconComponent = getIconComponent(category.icon);
        return <IconComponent className="w-8 h-8" />;
    }

    // Priority 2: Fallback String Matching (Legacy)
    const lower = category.name.toLowerCase();
    if (lower.includes('styrka')) return <DumbbellIcon className="w-8 h-8" />;
    if (lower.includes('hiit') || lower.includes('puls')) return <SparklesIcon className="w-8 h-8" />;
    if (lower.includes('rörlighet') || lower.includes('yoga')) return <div className="text-2xl">🧘</div>;
    if (lower.includes('ide') || lower.includes('tavla')) return <PencilIcon className="w-8 h-8" />;
    
    return <DumbbellIcon className="w-8 h-8" />;
};

// --- Modern Branded Card Component ---
const MenuCard: React.FC<{
    title: string;
    subTitle?: string;
    onClick: () => void;
    icon?: React.ReactNode;
    delay?: number;
    isWide?: boolean;
    isActive?: boolean;
    isBlurred?: boolean;
    isSparkling?: boolean; // New prop for the random effect
}> = ({ title, subTitle, onClick, icon, delay = 0, isWide = false, isActive = false, isBlurred = false, isSparkling = false }) => {
    
    // Animation variants
    const variants = {
        initial: { opacity: 0, y: 20, scale: 1, filter: "blur(0px)" },
        enter: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.5, delay, type: "spring" as const, stiffness: 100 } 
        },
        active: { 
            scale: 1.1, 
            zIndex: 50, 
            filter: "brightness(1.1)",
            transition: { duration: 0.4, ease: [0.43, 0.13, 0.23, 0.96] as const } 
        },
        blurred: { 
            opacity: 0, 
            scale: 0.9, 
            filter: "blur(10px)",
            transition: { duration: 0.4, ease: "easeInOut" as const } 
        },
        tap: { scale: 0.97 }
    };

    return (
        <motion.button
            initial="initial"
            animate={isActive ? "active" : isBlurred ? "blurred" : "enter"}
            whileTap={!isActive && !isBlurred ? "tap" : undefined}
            variants={variants}
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-3xl p-6 text-left transition-colors duration-500 flex flex-col justify-between
                ${isWide ? 'col-span-2 aspect-[2/1] sm:aspect-auto' : 'col-span-1 aspect-square'}
                bg-gradient-to-br from-primary to-teal-700 text-white
                shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] shadow-primary/30
                border-t border-l border-white/20
            `}
        >
            {/* Random Sparkle/Sheen Effect */}
            <AnimatePresence>
                {isSparkling && (
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: '200%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-20 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Flash effect overlay on click */}
            <AnimatePresence>
                {isActive && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.4, 0] }}
                        transition={{ duration: 0.4 }}
                        className="absolute inset-0 bg-white z-20 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            {/* Decorative background elements for depth */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none mix-blend-overlay"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

            <div className="z-10 flex flex-col h-full justify-between relative">
                <div className="mb-4 p-3 bg-white/10 w-fit rounded-2xl text-white backdrop-blur-md border border-white/10 shadow-inner transition-colors duration-300">
                    {icon || <DumbbellIcon className="w-8 h-8" />}
                </div>
                
                <div>
                    <h3 className="text-2xl sm:text-3xl font-black leading-tight drop-shadow-md tracking-tight">
                        {title}
                    </h3>
                    {subTitle && (
                        <p className="text-sm font-medium text-white/90 mt-2 transition-colors opacity-90">
                            {subTitle}
                        </p>
                    )}
                </div>
            </div>
        </motion.button>
    );
};

// --- Ambient Background Component ---
const AmbientBackground = () => (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-gray-50 dark:bg-gray-950">
        {/* These blobs now use the primary color (via opacity) to tint the background subtly */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
    </div>
);

interface HomeScreenProps {
    navigateTo: (page: Page) => void;
    onSelectWorkout: (workout: Workout) => void;
    onSelectPasskategori: (passkategori: Passkategori) => void;
    savedWorkouts: Workout[];
    onCreateNewWorkout: () => void;
    onShowBoostModal: () => void;
    studioConfig: StudioConfig;
    organizationLogoUrlLight?: string;
    organizationLogoUrlDark?: string;
    theme: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
    navigateTo, 
    onSelectWorkout, 
    onSelectPasskategori, 
    savedWorkouts, 
    onCreateNewWorkout, 
    onShowBoostModal, 
    studioConfig, 
    organizationLogoUrlLight, 
    organizationLogoUrlDark,
    theme
}) => {
  const [welcomeMessage, setWelcomeMessage] = useState({ title: "Hej på er!", subtitle: "Redo att köra?" });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  // State for the random "magic" sparkle effect
  const [sparklingIndex, setSparklingIndex] = useState<number | null>(null);
  const timeoutId = useRef<number | null>(null);

  useEffect(() => {
    const updateGreeting = () => {
        const hour = new Date().getHours();
        let greeting = "Hej!";
        if (hour < 10) greeting = "God morgon!";
        else if (hour < 14) greeting = "Hej!";
        else if (hour < 18) greeting = "God eftermiddag!";
        else greeting = "God kväll!";

        const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
        const dailyMsg = welcomeMessages[randomIndex];
        
        setWelcomeMessage({
            title: greeting,
            subtitle: dailyMsg.subtitle
        });
    };
    updateGreeting();
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const menuItems = useMemo(() => {
    const items: (MenuItem & { passkategori?: Passkategori, icon?: React.ReactNode, isWide?: boolean })[] = [];

    // --- Primary Categories ---
    studioConfig.customCategories.forEach((category, index) => {
        items.push({ 
            title: category.name, 
            action: () => onSelectPasskategori(category.name), 
            passkategori: category.name,
            icon: getIconForCategory(category),
            // isWide: index === 0 // Option: Make the first category wider
        });
    });

    // --- Feature Modules ---
    if (studioConfig.enableHyrox) {
      items.push({ 
          title: 'HYROX', 
          action: () => navigateTo(Page.Hyrox),
          icon: <HyroxIcon />,
      });
    }

    if (studioConfig.enableNotes) {
      items.push({ 
          title: 'Idé-tavlan', 
          subTitle: 'Rita & Skissa',
          action: () => navigateTo(Page.IdeaBoard),
          icon: <PencilIcon className="w-8 h-8" />,
      });
    }
    
    // --- Utility Items ---
    items.push({ 
        title: 'Timer', 
        subTitle: 'Intervall, Tabata, m.m.',
        action: () => navigateTo(Page.FreestandingTimer),
        icon: <TimerIcon />,
    });

    items.push({ 
        title: 'Övriga Pass', 
        subTitle: 'Sparade & Favoriter',
        action: () => navigateTo(Page.SavedWorkouts),
        icon: <StarIcon className="w-8 h-8" filled={false} />,
    });
    
    return items;
  }, [studioConfig, navigateTo, onSelectPasskategori]);

  // Logic for random sparkling
  useEffect(() => {
      if (menuItems.length === 0) return;

      const triggerSparkle = () => {
          // 1. Pick a random card
          const randomIndex = Math.floor(Math.random() * menuItems.length);
          setSparklingIndex(randomIndex);

          // 2. Remove the effect after a short duration (enough for animation to complete)
          setTimeout(() => {
              setSparklingIndex(null);
          }, 2000);

          // 3. Schedule the next sparkle
          // Random time between 45 seconds and 120 seconds (2 minutes)
          const minDelay = 45000; 
          const maxDelay = 120000;
          const nextDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
          
          timeoutId.current = window.setTimeout(triggerSparkle, nextDelay);
      };

      // Initial trigger: Wait a bit after load (e.g., 5 seconds) then start the loop
      const initialDelay = 5000;
      timeoutId.current = window.setTimeout(triggerSparkle, initialDelay);

      return () => {
          if(timeoutId.current) clearTimeout(timeoutId.current);
      };
  }, [menuItems.length]);

  const handleItemClick = (index: number, action: () => void) => {
      setActiveIndex(index);
      // Wait for animation before navigating
      setTimeout(() => {
          action();
          // Reset state slightly after navigation so it's clean if they come back
          setTimeout(() => setActiveIndex(null), 500);
      }, 350);
  };

  const logoUrl = theme === 'dark' 
    ? organizationLogoUrlDark || organizationLogoUrlLight 
    : organizationLogoUrlLight || organizationLogoUrlDark;

  const showQrCode = studioConfig.checkInImageEnabled && studioConfig.checkInImageUrl;

  return (
    <>
        <AmbientBackground />
        
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8 h-screen flex flex-col">
            {/* --- Main Content Area with 2 Columns --- */}
            <div className="flex-grow flex flex-col md:flex-row gap-8 overflow-hidden h-full pb-32">
                
                {/* Left Column (Menu & Welcome) - Flexible width */}
                <div className="flex-grow flex flex-col justify-start overflow-y-auto pr-2">
                    
                    {/* Header/Logo Area */}
                    <div className="mb-8 text-center md:text-left">
                        {logoUrl ? (
                            <motion.img 
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                src={logoUrl} 
                                alt="Logo" 
                                className="h-24 md:h-32 object-contain mb-4 mx-auto md:mx-0" 
                            />
                        ) : (
                            <h1 className="text-4xl font-black text-primary mb-4">SMART SKÄRM</h1>
                        )}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                                {welcomeMessage.title}
                            </h2>
                            <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 font-medium">
                                {welcomeMessage.subtitle}
                            </p>
                        </motion.div>
                    </div>

                    {/* Menu Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {menuItems.map((item, index) => (
                            <MenuCard
                                key={item.title}
                                title={item.title}
                                subTitle={item.subTitle}
                                onClick={() => handleItemClick(index, item.action)}
                                icon={item.icon}
                                delay={0.1 + (index * 0.05)}
                                isWide={item.isWide}
                                isActive={activeIndex === index}
                                isBlurred={activeIndex !== null && activeIndex !== index}
                                isSparkling={sparklingIndex === index}
                            />
                        ))}
                    </div>
                </div>

                {/* Right Column (Social & Status) - Fixed width on Desktop */}
                <div className="w-full md:w-80 lg:w-96 flex flex-col gap-6 flex-shrink-0 h-full">
                    
                    {/* Clock & Date */}
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="hidden md:flex flex-col items-end"
                    >
                        <span className={`text-6xl font-thin font-mono leading-none ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                            {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="text-primary uppercase tracking-widest font-bold text-sm mt-1">
                            {currentTime.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </motion.div>

                    {/* QR Code Card (if enabled) */}
                    {showQrCode && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 hidden md:flex flex-col items-center"
                        >
                            <img 
                                src={studioConfig.checkInImageUrl} 
                                alt="Check-in QR" 
                                className="w-32 h-32 object-contain" 
                            />
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-2">Checka in / Logga</p>
                        </motion.div>
                    )}

                    {/* Community Feed - The "Gym Flow" */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex-grow min-h-[300px] hidden md:block"
                    >
                        <CommunityFeed />
                    </motion.div>

                    {/* Weekly PB Feed */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="h-64 w-full hidden md:block"
                    >
                        <WeeklyPBList />
                    </motion.div>
                </div>
            </div>
        </div>
    </>
  );
};
