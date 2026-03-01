
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Page, Workout, MenuItem, StudioConfig, Passkategori, CustomCategoryWithPrompt } from '../types';
import { welcomeMessages } from '../data/welcomeMessages';
import { motion, AnimatePresence } from 'framer-motion';
import { DumbbellIcon, SparklesIcon, StarIcon, PencilIcon, getIconComponent, CloseIcon, LightningIcon, LockIcon } from './icons';
import { WeeklyPBList } from './WeeklyPBList'; 
import { CommunityFeed } from './CommunityFeed';
import { Modal } from './ui/Modal';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';

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
    isLocked?: boolean;
}> = ({ title, subTitle, onClick, icon, delay = 0, isActive = false, isBlurred = false, isSparkling = false, isLocked = false }) => {
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
            type="button"
            initial="initial"
            animate={isActive ? "active" : isBlurred ? "blurred" : "enter"}
            whileTap={!isActive && !isBlurred ? "tap" : undefined}
            variants={variants}
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-[2.5rem] p-6 text-left flex flex-col justify-between aspect-square w-full
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
                <div className="flex justify-between items-start">
                    <div className="mb-2 p-2 bg-white/15 w-fit rounded-xl text-white backdrop-blur-md border border-white/10 shadow-inner">
                        {icon || <DumbbellIcon className="w-6 h-6" />}
                    </div>
                    {isLocked && (
                        <div className="p-2 bg-black/20 rounded-full text-white/80 backdrop-blur-sm border border-white/10">
                            <LockIcon className="w-4 h-4" />
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black leading-tight drop-shadow-md tracking-tight uppercase">
                        {title}
                    </h3>
                    {subTitle && (
                        <p className="text-[10px] md:text-xs font-bold text-white/80 mt-1 uppercase tracking-widest">
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
  const { selectedOrganization, selectedStudio } = useStudio();
  const { isStudioMode } = useAuth();
  const [welcomeMessage, setWelcomeMessage] = useState({ title: "Hej på er!", subtitle: "Redo att köra?" });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sparklingIndex, setSparklingIndex] = useState<number | null>(null);
  const timeoutId = useRef<number | null>(null);

  // State för expanded view
  const [expandedList, setExpandedList] = useState<'feed' | 'pb' | null>(null);
  
  // State för lösenordsmodal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

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
    const items: (MenuItem & { passkategori?: Passkategori, icon?: React.ReactNode, isLocked?: boolean })[] = [];
    studioConfig.customCategories.forEach((category) => {
        items.push({ 
            title: category.name, 
            action: () => {
                if (category.isLocked) {
                    setPendingCategory(category.name);
                    setShowPasswordModal(true);
                } else {
                    onSelectPasskategori(category.name);
                }
            }, 
            passkategori: category.name,
            icon: getIconForCategory(category),
            isLocked: category.isLocked
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

      return <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Smart Skärm</h1>;
  };

  return (
    <>
        <AmbientBackground />
        
        <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-10 flex flex-col h-full overflow-hidden">
            
            {/* Header Section */}
            <div className="flex flex-shrink-0 justify-between items-start mb-6 w-full pt-4">
                <div className="flex flex-col gap-3">
                    {renderBranding()}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{welcomeMessage.title}</h2>
                        <p className="text-base md:text-lg text-gray-400 font-medium mt-1">...{welcomeMessage.subtitle}</p>
                    </motion.div>
                </div>

                <div className="flex flex-col items-end gap-3">
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-right">
                        <span className="block text-5xl md:text-7xl font-thin font-mono leading-none text-gray-900 dark:text-white">
                            {currentTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="text-primary uppercase tracking-[0.2em] font-black text-xs md:text-sm mt-1.5 block">
                            {currentTime.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </motion.div>
                </div>
            </div>

            {/* Meny-grid */}
            <div className={`flex-grow overflow-y-auto pr-2 custom-scrollbar min-h-0 ${!studioConfig.enableWorkoutLogging ? 'mb-12' : 'mb-8'}`}>
                <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${studioConfig.enableWorkoutLogging ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-6`}>
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
                            isLocked={item.isLocked}
                        />
                    ))}
                </div>
            </div>

            {/* Botten-dashboard - Endast om loggning är på */}
            {studioConfig.enableWorkoutLogging && (
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
            )}
        </div>

        {/* EXPANDED MODAL VIEW */}
        <AnimatePresence>
            {expandedList && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                    onClick={() => setExpandedList(null)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-5xl h-[85vh] bg-white dark:bg-gray-950 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 flex flex-col relative"
                    >
                        {/* Internal Header with Close Button */}
                        <div className="flex items-center justify-between p-8 border-b border-gray-100 dark:border-gray-800">
                             <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                 {expandedList === 'feed' ? 'Fullständigt Flöde' : 'Wall of Fame'}
                             </h3>
                             <button 
                                onClick={() => setExpandedList(null)}
                                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-500 dark:text-white shadow-sm active:scale-90"
                            >
                                <CloseIcon className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="flex-grow overflow-hidden p-6">
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

        {/* Lösenordsmodal för låsta kategorier */}
        <AnimatePresence>
            {showPasswordModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
                    >
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <LockIcon className="w-8 h-8" />
                            </div>
                        </div>
                        
                        <h2 className="text-2xl font-black text-center text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                            Låst Kategori
                        </h2>
                        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
                            Ange coach-lösenordet för att låsa upp "{pendingCategory}".
                        </p>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (passwordInput === selectedOrganization?.passwords.coach) {
                                setShowPasswordModal(false);
                                setPasswordInput("");
                                setPasswordError(false);
                                if (pendingCategory) {
                                    onSelectPasskategori(pendingCategory);
                                }
                            } else {
                                setPasswordError(true);
                                setPasswordInput("");
                            }
                        }}>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => {
                                    setPasswordInput(e.target.value);
                                    setPasswordError(false);
                                }}
                                placeholder="Lösenord"
                                className={`w-full text-center text-2xl tracking-widest p-4 rounded-xl border-2 bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none transition-colors ${
                                    passwordError 
                                        ? 'border-red-500 focus:border-red-500' 
                                        : 'border-gray-200 dark:border-gray-800 focus:border-primary'
                                }`}
                                autoFocus
                            />
                            
                            {passwordError && (
                                <p className="text-red-500 text-center text-sm font-bold mt-3 animate-shake">
                                    Fel lösenord, försök igen.
                                </p>
                            )}

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setPasswordInput("");
                                        setPasswordError(false);
                                    }}
                                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    AVBRYT
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-4 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-colors"
                                >
                                    LÅS UPP
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </>
  );
};
