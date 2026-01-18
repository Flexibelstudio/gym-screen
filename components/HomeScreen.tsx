import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, Workout, MenuItem, StudioConfig, Passkategori, CustomCategoryWithPrompt } from '../types';
import { welcomeMessages } from '../data/welcomeMessages';
import { motion, AnimatePresence } from 'framer-motion';
import { DumbbellIcon, SparklesIcon, StarIcon, PencilIcon, getIconComponent, CloseIcon } from './icons';
import { WeeklyPBList } from './WeeklyPBList'; 
import { CommunityFeed } from './CommunityFeed';
import { Modal } from './ui/Modal';
import { useStudio } from '../context/StudioContext';

const TimerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HyroxIcon = () => (
  <span className="text-2xl font-black tracking-tighter">HX</span>
);

const getIconForCategory = (category: CustomCategoryWithPrompt) => {
    if (category.icon) {
        const IconComponent = getIconComponent(category.icon);
        return <IconComponent className="w-8 h-8" />;
    }
    const lower = category.name.toLowerCase();
    if (lower.includes('styrka')) return <DumbbellIcon className="w-8 h-8" />;
    if (lower.includes('hiit') || lower.includes('puls')) return <SparklesIcon className="w-8 h-8" />;
    if (lower.includes('rörlighet') || lower.includes('yoga')) return <div className="text-2xl">🧘</div>;
    if (lower.includes('ide') || lower.includes('tavla')) return <PencilIcon className="w-8 h-8" />;
    return <DumbbellIcon className="w-8 h-8" />;
};

const MenuCard: React.FC<{
    title: string;
    subTitle?: string;
    onClick: () => void;
    icon?: React.ReactNode;
    delay?: number;
    isActive?: boolean;
    isBlurred?: boolean;
    isSparkling?: boolean;
}> = ({ title, subTitle, onClick, icon, delay = 0, isActive = false, isBlurred = false, isSparkling = false }) => {
    const variants = {
        initial: { opacity: 0, y: 20, scale: 1, filter: "blur(0px)" },
        enter: { 
            opacity: 1, 
            y: 0, 
            transition: { duration: 0.5, delay, type: "spring" as const, stiffness: 100 } 
        },
        active: { 
            scale: 1.05, 
            zIndex: 50, 
            filter: "brightness(1.1)",
            transition: { duration: 0.3 } 
        },
        blurred: { 
            opacity: 0.6, 
            scale: 0.95, 
            filter: "blur(4px)",
            transition: { duration: 0.4 } 
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
                relative overflow-hidden rounded-[2.5rem] p-6 text-left flex flex-col justify-between h-full min-h-[140px]
                bg-gradient-to-br from-primary to-teal-700 text-white
                shadow-xl border-t border-l border-white/20 transition-all duration-300
                hover:shadow-primary/20 hover:-translate-y-1
            `}
        >
            <AnimatePresence>
                {isSparkling && (
                    <motion.div
                        initial={{ x: '-100%', opacity: 0 }}
                        animate={{ x: '200%', opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="absolute inset-0 z-20 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 pointer-events-none"
                    />
                )}
            </AnimatePresence>

            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none mix-blend-overlay"></div>

            <div className="z-10 flex flex-col h-full justify-between relative">
                <div className="mb-2 p-2 bg-white/15 w-fit rounded-xl text-white backdrop-blur-md border border-white/10 shadow-inner">
                    {icon || <DumbbellIcon className="w-6 h-6" />}
                </div>
                <div>
                    <h3 className="text-lg sm:text-xl font-black leading-tight drop-shadow-md tracking-tight uppercase">
                        {title}
                    </h3>
                    {subTitle && (
                        <p className="text-[9px] font-bold text-white/80 mt-0.5 uppercase tracking-widest">
                            {subTitle}
                        </p>
                    )}
                </div>
            </div>
        </motion.button>
    );
};

const AmbientBackground = () => (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-gray-50 dark:bg-gray-950">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary/10 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
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
    studioLoading?: boolean;
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
    theme,
    studioLoading = false
}) => {
  const { selectedOrganization } = useStudio();
  const [welcomeMessage, setWelcomeMessage] = useState({ title: "Hej på er!", subtitle: "Redo att köra?" });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sparklingIndex, setSparklingIndex] = useState<number | null>(null);
  const timeoutId = useRef<number | null>(null);

  // State för expanded view
  const [expandedList, setExpandedList] = useState<'feed' | 'pb' | null>(null);

  useEffect(() => {
    const updateGreeting = () => {
        const hour = new Date().getHours();
        let greeting = "Hej!";
        if (hour < 10) greeting = "God morgon!";
        else if (hour < 14) greeting = "Hej!";
        else if (hour < 18) greeting = "God eftermiddag!";
        else greeting = "God kväll!";
        const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
        setWelcomeMessage({ title: greeting, subtitle: welcomeMessages[randomIndex].subtitle });
    };
    updateGreeting();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const menuItems = useMemo(() => {
    const items: (MenuItem & { passkategori?: Passkategori, icon?: React.ReactNode })[] = [];
    studioConfig.customCategories.forEach((category) => {
        items.push({ 
            title: category.name, 
            action: () => onSelectPasskategori(category.name), 
            passkategori: category.name,
            icon: getIconForCategory(category)
        });
    });
    if (studioConfig.enableHyrox) items.push({ title: 'HYROX', action: () => navigateTo(Page.Hyrox), icon: <HyroxIcon /> });
    if (studioConfig.enableNotes) items.push({ title: 'Idé-tavlan', subTitle: 'Rita & Skissa', action: () => navigateTo(Page.IdeaBoard), icon: <PencilIcon className="w-8 h-8" /> });
    items.push({ title: 'Timer', subTitle: 'Intervall', action: () => navigateTo(Page.FreestandingTimer), icon: <TimerIcon /> });
    items.push({ title: 'Övriga pass', subTitle: 'Favoriter & Utkast', action: () => navigateTo(Page.SavedWorkouts), icon: <StarIcon className="w-8 h-8" filled={false} /> });
    return items;
  }, [studioConfig, navigateTo, onSelectPasskategori]);

  useEffect(() => {
      if (menuItems.length === 0) return;
      const triggerSparkle = () => {
          setSparklingIndex(Math.floor(Math.random() * menuItems.length));
          setTimeout(() => setSparklingIndex(null), 2000);
          timeoutId.current = window.setTimeout(triggerSparkle, Math.floor(Math.random() * (120000 - 45000 + 1) + 45000));
      };
      timeoutId.current = window.setTimeout(triggerSparkle, 5000);
      return () => { if(timeoutId.current) clearTimeout(timeoutId.current); };
  }, [menuItems.length]);

  const handleItemClick = (index: number, action: () => void) => {
      setActiveIndex(index);
      setTimeout(() => {
          action();
          setTimeout(() => setActiveIndex(null), 500);
      }, 350);
  };

  const logoUrl = theme === 'dark' ? organizationLogoUrlDark || organizationLogoUrlLight : organizationLogoUrlLight || organizationLogoUrlDark;
  const showQrCode = studioConfig.checkInImageEnabled && studioConfig.checkInImageUrl;

  // Defensiv rendering: Visa text ENDAST om vi laddat klart, har en org, men ingen bild.
  const renderBranding = () => {
      if (studioLoading || (!selectedOrganization && !logoUrl)) {
          return <div className="h-16 md:h-24 w-48 bg-transparent"></div>;
      }
      
      if (logoUrl) {
          return (
            <motion.img 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                src={logoUrl} 
                alt="Logo" 
                className="h-16 md:h-24 object-contain self-start" 
            />
          );
      }

      // Om ingen logga finns i databasen alls efter laddning
      return <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Smart Skärm</h1>;
  };

  return (
    <>
        <AmbientBackground />
        
        <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-10 flex flex-col h-full overflow-hidden">
            
            {/* Header Section - Fast höjd */}
            <div className="flex flex-shrink-0 justify-between items-start mb-6 w-full pt-4">
                <div className="flex flex-col gap-3">
                    {renderBranding()}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{welcomeMessage.title}</h2>
                        <p className="text-base md:text-lg text-gray-400 font-medium mt-1">...{welcomeMessage.subtitle}</p>
                    </motion.div>
                </div>

                <div className="flex flex-col items-end gap-4">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-right">
                        <span className="block text-5xl md:text-7xl font-thin font-mono leading-none text-gray-900 dark:text-white">
                            {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="text-primary uppercase tracking-[0.2em] font-black text-xs md:text-sm mt-1.5 block">
                            {currentTime.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </motion.div>
                    
                    {showQrCode && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="bg-white p-2.5 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center">
                            <img src={studioConfig.checkInImageUrl} alt="QR" className="w-16 h-16 object-contain" />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Meny-grid - Flexibel höjd för att fylla utrymmet */}
            <div className="flex-grow overflow-y-auto pr-2 mb-8 custom-scrollbar min-h-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 auto-rows-fr">
                    {menuItems.map((item, index) => (
                        <MenuCard
                            key={item.title}
                            title={item.title}
                            subTitle={item.subTitle}
                            onClick={() => handleItemClick(index, item.action)}
                            icon={item.icon}
                            delay={0.1 + (index * 0.03)}
                            isActive={activeIndex === index}
                            isBlurred={activeIndex !== null && activeIndex !== index}
                            isSparkling={sparklingIndex === index}
                        />
                    ))}
                </div>
            </div>

            {/* Botten-dashboard - Fast höjd (400px) för att garantera 4 rader + rubrik och rundat avslut */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-6 h-[400px] mb-6">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.6 }}
                    className="h-full"
                >
                    <CommunityFeed onExpand={() => setExpandedList('feed')} />
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.7 }}
                    className="h-full"
                >
                    <WeeklyPBList onExpand={() => setExpandedList('pb')} />
                </motion.div>
            </div>
        </div>

        {/* EXPANDED MODAL VIEW */}
        <AnimatePresence>
            {expandedList && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="w-full max-w-5xl h-[85vh] relative"
                    >
                        <button 
                            onClick={() => setExpandedList(null)}
                            className="absolute -top-16 right-0 text-white hover:text-primary transition-colors flex items-center gap-2 font-black uppercase tracking-widest"
                        >
                            <span>Stäng</span>
                            <CloseIcon className="w-8 h-8" />
                        </button>

                        <div className="h-full">
                            {expandedList === 'feed' ? (
                                <CommunityFeed isExpanded />
                            ) : (
                                <WeeklyPBList isExpanded />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </>
  );
};