
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
    hasCustomBack?: boolean;
    navigateTo?: (page: Page) => void;
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
    isStudioMode,
    hasCustomBack = false,
    navigateTo
}) => {
  const { selectedOrganization, studioConfig, studioLoading } = useStudio();
  const { userData, stopImpersonation } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Reset isExiting when page changes
  useEffect(() => {
      setIsExiting(false);
  }, [page]);

  const handleBackClick = () => {
      if (isExiting) return;
      
      if (hasCustomBack) {
          onBack();
          return;
      }

      setIsExiting(true);
      // Short delay to allow the UI to paint the exiting state (overlay fade out)
      setTimeout(() => {
          onBack();
      }, 50);
  };
  
  // Hämta positionering från config (default 'top')
  const navPosition = studioConfig?.navigationControlPosition || 'top';

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
  
  // FIX: Force back button visibility in Studio Mode if not on Home screen
  const isStudioContent = isStudioMode && page !== Page.Home;
  const canGoBack = (historyLength > 1 && !pagesWithoutBack.includes(page)) || isStudioContent || hasCustomBack;

  const isMemberAppView = (!isStudioMode && page === Page.Home) || page === Page.MemberProfile;

  // Render back button depending on position config
  const renderBackButton = () => {
      // If manually hidden (e.g. running timer), return null
      if (hideBackButton) return null;
      // If not applicable to go back
      if (!canGoBack) return null;
      
      const buttonContent = (
          <div className="flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
             </svg>
             <span className="text-lg font-bold">Tillbaka</span>
          </div>
      );
      
      if (navPosition === 'bottom') {
          // Apply visibility transition classes to the fixed bottom button as well
          const visibilityClass = isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none';
          
          return (
             <button 
                onPointerDown={(e) => {
                    if (e.button === 0) {
                        e.preventDefault();
                        handleBackClick();
                    }
                }}
                onClick={(e) => {
                    if (e.detail === 0) {
                        handleBackClick();
                    }
                }}
                className={`fixed bottom-6 left-6 z-[100] bg-gray-900/90 dark:bg-white/90 text-white dark:text-black hover:bg-gray-800 dark:hover:bg-white transition-all py-5 px-10 rounded-full shadow-2xl backdrop-blur-md border border-white/20 active:scale-95 active:duration-75 duration-300 ${visibilityClass}`}
            >
                {buttonContent}
            </button>
          );
      }
      
      return (
        <button 
            onPointerDown={(e) => {
                if (e.button === 0) {
                    e.preventDefault();
                    handleBackClick();
                }
            }}
            onClick={(e) => {
                if (e.detail === 0) {
                    handleBackClick();
                }
            }}
            className="text-primary hover:brightness-95 transition-colors text-lg font-semibold flex items-center gap-1 p-3 -ml-3 active:scale-95 active:duration-75"
        >
            {buttonContent}
        </button>
      );
  };

  const renderHeaderBranding = () => {
      // Om vi laddar eller om vi inte har en organisation i state än, visa inget
      if (studioLoading || (!selectedOrganization && !logoUrl)) {
          return <div className="h-10 md:h-12 w-32 bg-transparent"></div>;
      }

      const isFavicon = !!selectedOrganization?.faviconUrl;
      const displayUrl = selectedOrganization?.faviconUrl || logoUrl;

      if (displayUrl) {
          return (
              <img 
                  src={displayUrl} 
                  alt="Logo" 
                  className={`h-10 md:h-12 w-auto object-contain pointer-events-none ${isFavicon ? 'scale-[1.5] origin-left' : ''}`} 
              />
          );
      }

      // Sista utväg om laddning är klar men logga saknas helt
      return (
        <span className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white pointer-events-none">
            {selectedOrganization?.name || 'SMART'}
        </span>
      );
  };

  const renderProfileMenu = () => {
      const isAdminRole = role === 'coach' || role === 'organizationadmin' || role === 'systemowner';

      return (
          <div className="relative" ref={dropdownRef}>
              <button
                  onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
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
                      {onEditProfileRequest && (
                          <button 
                              onClick={() => { setIsDropdownOpen(false); onEditProfileRequest(); }} 
                              className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                          >
                              <PencilIcon className="w-4 h-4" /> Redigera profil
                          </button>
                      )}
                      
                      {onMemberProfileRequest && (
                          <button 
                              onClick={() => { setIsDropdownOpen(false); if (stopImpersonation) stopImpersonation(); onMemberProfileRequest(); }} 
                              className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                          >
                              <UserIcon className="w-4 h-4" /> Medlemsvy
                          </button>
                      )}

                      {userData?.stripeCustomerId && (
                          <button 
                              onClick={async () => {
                                  setIsDropdownOpen(false);
                                  try {
                                      const apiUrl = import.meta.env.VITE_API_URL;
                                      const res = await fetch(`${apiUrl}/create-portal-session`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ customerId: userData.stripeCustomerId })
                                      });
                                      const data = await res.json();
                                      if (data.url) window.location.href = data.url;
                                  } catch (e) {
                                      console.error("Error opening portal:", e);
                                  }
                              }} 
                              className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                              Hantera prenumeration
                          </button>
                      )}
                      
                      {isAdminRole && (
                          <>
                              <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2"></div>
                              
                              {navigateTo && page !== Page.SuperAdmin && (
                                  <button 
                                      onClick={() => { setIsDropdownOpen(false); navigateTo(Page.SuperAdmin); }} 
                                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                  >
                                      <SettingsIcon className="w-4 h-4" /> Admin
                                  </button>
                              )}

                              {onCoachAccessRequest && (
                                  <button 
                                      onClick={() => { setIsDropdownOpen(false); onCoachAccessRequest(); }} 
                                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                  >
                                      <BriefcaseIcon className="w-4 h-4" /> Coach-vy
                                  </button>
                              )}

                              {navigateTo && page !== Page.CoachNotes && (
                                  <button 
                                      onClick={() => { setIsDropdownOpen(false); navigateTo(Page.CoachNotes); }} 
                                      className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                                  >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.89l12.683-12.683z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
                                      </svg>
                                      Anteckningar
                                  </button>
                              )}
                          </>
                      )}

                      <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2"></div>
                      
                      <button 
                          onClick={() => { setIsDropdownOpen(false); toggleTheme(); }} 
                          className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-3"
                      >
                          {theme === 'dark' ? (
                              <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                  </svg>
                                  Ljust läge
                              </>
                          ) : (
                              <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                  </svg>
                                  Mörkt läge
                              </>
                          )}
                      </button>

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

            <div id="member-header-tabs" className="flex-1 flex justify-end items-center mx-2 mr-4"></div>

            <div className="flex items-center gap-3 md:gap-4">
                {renderProfileMenu()}
            </div>
        </header>
      );
  }

  // För Admin och Systemägar-skärmarna som har sina egna fasta headermoduler, 
  // ska vi bara rendera profilmenyn absolut placerad över deras tomma högra sida.
  // Detta förhindrar att en överflödig, tom <header> trycker ner hela admin-layouten.
  if (page === Page.SuperAdmin || page === Page.SystemOwner) {
      return (
         <div className="fixed top-2.5 lg:top-3 right-4 sm:right-6 z-[60] flex items-center">
             {renderProfileMenu()}
         </div>
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
      case Page.IdeaBoard: return "AI Whiteboard";
      case Page.Hyrox: return "HYROX Träning";
      case Page.HyroxRaceList: return "Tidigare Lopp";
      case Page.HyroxRaceDetail: return "Resultat";
      case Page.WorkoutGamesHub: return "Träningslekar";
      case Page.MemberRegistry: return "Medlemsregister";
      case Page.MobileLog: return "Logga Pass";
      case Page.AdminAnalytics: return "Statistik & Trender";
      case Page.Coach: return "Coach";
      default: return "";
    }
  }

  return (
    <>
        <header className={`w-full max-w-5xl mx-auto flex items-center transition-all duration-300 ease-in-out ${isVisible ? 'pb-8 opacity-100 max-h-40' : 'pb-0 opacity-0 max-h-0 pointer-events-none overflow-hidden'}`}>
        <div className="flex-1">
            {/* Standard top-left back button, only shown if pos is 'top' */}
            {navPosition === 'top' && renderBackButton()}
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-none">{getTitle()}</h1>
        </div>

        <div className="flex-1 flex justify-end items-center gap-2 lg:gap-4">
            {showClock && <DigitalClock />}
            {!isStudioMode && renderProfileMenu()}
            {isStudioMode && (
                <div className="flex items-center gap-1">
                    <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-gray-200" aria-label="Byt färgtema">
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
                    {onCoachAccessRequest && (
                        <button onClick={onCoachAccessRequest} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white" aria-label="Coach-åtkomst">
                            <BriefcaseIcon className="w-6 h-6" />
                        </button>
                    )}
                </div>
            )}
        </div>
        </header>
        
        {/* Render fixed bottom back button if configured */}
        {navPosition === 'bottom' && renderBackButton()}
        
        {/* Exiting overlay for immediate visual feedback */}
        {isExiting && (
            <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm transition-opacity duration-100 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
        )}
    </>
  );
};
