import React, { useState, useRef, useEffect } from 'react';
import { Page, UserRole } from '../../types';
import { DigitalClock } from '../common/DigitalClock';
import { UserIcon, BriefcaseIcon, SettingsIcon, PencilIcon } from '../icons';
import { useStudio } from '../../context/StudioContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderProps {
    page: Page;
    onBack: () => void;
    theme: string;
    toggleTheme: () => void;
    isVisible?: boolean;
    activeCustomPageTitle?: string;
    onSignOut?: () => void;
    role?: UserRole;
    historyLength: number;
    showClock?: boolean;
    hideBackButton?: boolean;
    onCoachAccessRequest?: () => void;
    showCoachButton?: boolean;
    onMemberProfileRequest?: () => void;
    onEditProfileRequest?: () => void;
    isStudioMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
    page, 
    onBack, 
    theme, 
    toggleTheme, 
    isVisible = true, 
    activeCustomPageTitle, 
    onSignOut, 
    role, 
    historyLength, 
    showClock, 
    hideBackButton = false, 
    onCoachAccessRequest, 
    showCoachButton,
    onMemberProfileRequest,
    onEditProfileRequest,
    isStudioMode
}) => {
  const { selectedOrganization, studioLoading } = useStudio();
  const { userData } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const logoUrl = theme === 'dark' 
    ? selectedOrganization?.logoUrlDark || selectedOrganization?.logoUrlLight 
    : selectedOrganization?.logoUrlLight || selectedOrganization?.logoUrlDark;

  const pagesWithoutBack = [
    Page.Home, 
    Page.MemberProfile, 
    Page.SystemOwner, 
    Page.SuperAdmin, 
    Page.StudioSelection
  ];
  
  const canGoBack = historyLength > 1 && !pagesWithoutBack.includes(page);

  const getTitle = () => {
    switch(page) {
      case Page.CustomContent: return activeCustomPageTitle || 'Information';
      case Page.AIGenerator: return "Pass & Program";
      case Page.FreestandingTimer: return "Timer";
      case Page.WorkoutBuilder: return "Passbyggaren";
      case Page.SimpleWorkoutBuilder: return "Skapa Pass";
      case Page.WorkoutList: return "Välj Pass";
      case Page.SavedWorkouts: return "Mina Pass";
      case Page.StudioSelection: return "Välj Studio";
      case Page.RepsOnly: return "Övningar";
      case Page.IdeaBoard: return "Idé-tavlan";
      case Page.Hyrox: return "HYROX";
      case Page.HyroxRaceList: return "Lopp";
      case Page.HyroxRaceDetail: return "Resultat";
      case Page.MemberRegistry: return "Medlemmar";
      case Page.MobileLog: return "Logga";
      case Page.AdminAnalytics: return "Analys";
      case Page.Coach: return "Coach";
      default: return "";
    }
  }

  if (!isVisible) return null;

  return (
    <header className="w-full max-w-7xl mx-auto flex items-center justify-between py-2 px-4 z-[100] relative bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-2xl mb-4 border border-gray-100 dark:border-gray-800 shadow-sm">
        
        {/* LEFT GROUP: Back + Logo/Title */}
        <div className="flex items-center gap-3">
            {canGoBack && !hideBackButton && (
                <button onClick={onBack} className="p-2 -ml-2 text-primary hover:bg-primary/10 rounded-full transition-colors flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}
            
            <div className="flex items-center gap-3">
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-6 sm:h-8 w-auto object-contain" />
                ) : (
                    <span className="text-lg font-black tracking-tighter text-primary">{selectedOrganization?.name || 'SMART'}</span>
                )}
                {page !== Page.Home && (
                    <span className="hidden sm:inline-block text-gray-300 dark:text-gray-700">|</span>
                )}
                <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                    {page === Page.Home ? 'Hem' : getTitle()}
                </h1>
            </div>
        </div>

        {/* RIGHT GROUP: Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
            {showClock && (
                <div className="hidden md:block mr-2 scale-75 transform-gpu origin-right">
                    <DigitalClock />
                </div>
            )}

            {showCoachButton && onCoachAccessRequest && (
                <button onClick={onCoachAccessRequest} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Coach-vy">
                    <BriefcaseIcon className="w-5 h-5" />
                </button>
            )}

            <button onClick={toggleTheme} className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Tema">
                {theme === 'dark' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                )}
            </button>

            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:ring-2 hover:ring-primary/20 transition-all"
                >
                    <span className="hidden md:inline text-xs font-bold text-gray-600 dark:text-gray-300">{userData?.firstName || 'Profil'}</span>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary overflow-hidden shadow-inner">
                        {userData?.photoUrl ? (
                            <img src={userData.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-4 h-4" />
                        )}
                    </div>
                </button>

                <AnimatePresence>
                    {isDropdownOpen && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 py-2 z-50 overflow-hidden"
                        >
                            {onMemberProfileRequest && (
                                <button onClick={() => { setIsDropdownOpen(false); onMemberProfileRequest(); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3">
                                    <UserIcon className="w-4 h-4 text-primary" /> Min profil
                                </button>
                            )}
                            {onEditProfileRequest && (
                                <button onClick={() => { setIsDropdownOpen(false); onEditProfileRequest(); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3">
                                    <PencilIcon className="w-4 h-4 text-gray-400" /> Redigera profil
                                </button>
                            )}
                            {(role === 'coach' || role === 'organizationadmin' || role === 'systemowner') && onCoachAccessRequest && isStudioMode && (
                                <button onClick={() => { setIsDropdownOpen(false); onCoachAccessRequest(); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3">
                                    <BriefcaseIcon className="w-4 h-4 text-primary" /> Coach-vy
                                </button>
                            )}
                            <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2"></div>
                            {onSignOut && (
                                <button onClick={() => { setIsDropdownOpen(false); onSignOut(); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Logga ut
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </header>
  );
};