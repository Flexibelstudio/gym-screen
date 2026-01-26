import React, { useState, useRef, useEffect } from 'react';
import { Page, UserRole } from '../../types';
import { DigitalClock } from '../common/DigitalClock';
import { UserIcon, BriefcaseIcon, SettingsIcon, PencilIcon } from '../icons';
import { useStudio } from '../../context/StudioContext';
import { useAuth } from '../../context/AuthContext';

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

  const themeToggleButton = (
    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Växla tema">
      {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );

  const pagesWithoutBack = [
    Page.Home, 
    Page.MemberProfile, 
    Page.SystemOwner, 
    Page.SuperAdmin, 
    Page.StudioSelection
  ];
  
  const canGoBack = historyLength > 1 && !pagesWithoutBack.includes(page);

  const isMemberAppView = (!isStudioMode && page === Page.Home) || page === Page.MemberProfile;

  const renderHeaderBranding = () => {
      // Om vi laddar eller om vi inte har en organisation i state än, visa inget
      if (studioLoading || (!selectedOrganization && !logoUrl)) {
          return <div className="h-10 md:h-12 w-32 bg-transparent"></div>;
      }

      if (logoUrl) {
          return <img src={logoUrl} alt="Logo" className="h-10 md:h-12 w-auto object-contain pointer-events-none" />;
      }

      // Sista utväg om laddning är klar men logga saknas helt
      return (
        <span className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white pointer-events-none">
            {selectedOrganization?.name || 'SMART'}
        </span>
      );
  };

  if (isMemberAppView) {
      return (
        <header className="w-full max-w-6xl mx-auto flex justify-between items-center pt-6 pb-6 px-4 sm:px-6 z-30 relative">
            <div className="flex items-center gap-4">
                <div className="flex-shrink-0 cursor-default">
                    {page !== Page.Home && renderHeaderBranding()}
                </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                {themeToggleButton}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:ring-2 hover:ring-primary transition-all shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700"
                    >
                        {userData?.photoUrl ? (
                            <img src={userData.photoUrl} alt="Profil" className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-6 h-6" />
                        )}
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden py-2 animate-fade-in origin-top-right z-50">
                            {page !== Page.MemberProfile && onMemberProfileRequest && (
                                <button 
                                    onClick={() => { setIsDropdownOpen(false); onMemberProfileRequest(); }} 
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                >
                                    <UserIcon className="w-4 h-4" /> Min profil
                                </button>
                            )}
                            {onEditProfileRequest && (
                                <button 
                                    onClick={() => { setIsDropdownOpen(false); onEditProfileRequest(); }} 
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                >
                                    <PencilIcon className="w-4 h-4" /> Redigera profil
                                </button>
                            )}
                            
                            {(role === 'coach' || role === 'organizationadmin' || role === 'systemowner') && onCoachAccessRequest && (
                                <button 
                                    onClick={() => { setIsDropdownOpen(false); onCoachAccessRequest(); }} 
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                >
                                    <BriefcaseIcon className="w-4 h-4" /> Coach-vy
                                </button>
                            )}

                            <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2"></div>
                            
                            {onSignOut && (
                                <button 
                                    onClick={() => { setIsDropdownOpen(false); onSignOut(); }} 
                                    className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors flex items-center gap-3"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Logga ut
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
      );
  }

  const getTitle = () => {
    switch(page) {
      case Page.CustomContent: return activeCustomPageTitle || 'Information';
      case Page.AIGenerator: return "Pass & Program";
      case Page.FreestandingTimer: return "Timer";
      case Page.WorkoutBuilder: return "Passbyggaren";
      case Page.SimpleWorkoutBuilder: return "Skapa Nytt Pass";
      case Page.WorkoutList: return "Välj Pass";
      case Page.SavedWorkouts: return "Övriga Pass";
      case Page.StudioSelection: return "Välj Studio";
      case Page.RepsOnly: return "Övningar";
      case Page.IdeaBoard: return "Idé-tavlan";
      case Page.Hyrox: return "HYROX Träning";
      case Page.HyroxRaceList: return "Tidigare Lopp";
      case Page.HyroxRaceDetail: return "Resultat";
      case Page.MemberRegistry: return "Medlemsregister";
      case Page.MobileLog: return "Logga Pass";
      case Page.AdminAnalytics: return "Statistik & Trender";
      case Page.Coach: return "Coach";
      default: return "";
    }
  }

  return (
    <header className={`w-full max-w-5xl mx-auto flex items-center transition-all duration-300 ease-in-out ${isVisible ? 'pb-8 opacity-100 max-h-40' : 'pb-0 opacity-0 max-h-0 pointer-events-none overflow-hidden'}`}>
      <div className="flex-1">
        {canGoBack && !hideBackButton && (
            <button onClick={onBack} className="text-primary hover:brightness-95 transition-colors text-lg font-semibold flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Tillbaka</span>
            </button>
        )}
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-none">{getTitle()}</h1>
      </div>

      <div className="flex-1 flex justify-end items-center gap-4">
         {showClock && <DigitalClock />}
         {page !== Page.MemberProfile && onMemberProfileRequest && !isStudioMode && (
            <button onClick={onMemberProfileRequest} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white" aria-label="Min Profil">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/20 overflow-hidden shadow-sm">
                    {userData?.photoUrl ? (
                        <img src={userData.photoUrl} alt="Profil" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-5 h-5" />
                    )}
                </div>
            </button>
         )}
         {showCoachButton && onCoachAccessRequest && (
            <button onClick={onCoachAccessRequest} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white" aria-label="Coach-åtkomst">
                <BriefcaseIcon className="w-6 h-6" />
            </button>
         )}
         {themeToggleButton}
         {onSignOut && (
            <button onClick={onSignOut} className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-lg font-semibold px-2">
                Logga ut
            </button>
         )}
      </div>
    </header>
  );
};