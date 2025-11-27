
import React from 'react';
import { Page, UserRole } from '../../types';
import { DigitalClock } from '../common/DigitalClock';
import { UserIcon } from '../icons';

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
    showCoachButton 
}) => {
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

  const canGoBack = historyLength > 1;

  const coachButton = showCoachButton && onCoachAccessRequest && (
    <button onClick={onCoachAccessRequest} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-800 dark:text-white" aria-label="Coach-åtkomst">
      <UserIcon className="w-6 h-6" />
    </button>
  );

  if (page === Page.Home) {
      return (
        <header className="w-full max-w-5xl mx-auto flex justify-end items-center pb-8 gap-4">
           {showClock && <DigitalClock />}
           {coachButton}
           {themeToggleButton}
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
      case Page.SuperAdmin: return "";
      case Page.SystemOwner: return "Systemägare";
      case Page.RepsOnly: return "Övningar";
      case Page.CustomPageEditor: return "";
      case Page.IdeaBoard: return "Idé-tavlan";
      case Page.Hyrox: return "HYROX Träning";
      case Page.HyroxRaceList: return "Tidigare Lopp";
      case Page.HyroxRaceDetail: return "Resultat";
      default: return "";
    }
  }

  return (
    <header className={`w-full max-w-5xl mx-auto flex items-center transition-all duration-300 ease-in-out ${isVisible ? 'pb-8 opacity-100 max-h-40' : 'pb-0 opacity-0 max-h-0 pointer-events-none overflow-hidden'}`}>
      <div className="flex-1">
        {canGoBack && !hideBackButton && (
            <button onClick={onBack} className="text-primary hover:brightness-95 transition-colors text-lg font-semibold">
                <span>Tillbaka</span>
            </button>
        )}
      </div>
      <div className="flex-1 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{getTitle()}</h1>
      </div>
      <div className="flex-1 flex justify-end items-center gap-4">
         {showClock && <DigitalClock />}
         {coachButton}
         {themeToggleButton}
         {onSignOut && (
            <button onClick={onSignOut} className="text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors text-lg font-semibold">
                Logga ut
            </button>
         )}
      </div>
    </header>
  );
};
