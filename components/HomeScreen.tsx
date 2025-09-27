





import React, { useState, useEffect, useMemo } from 'react';
import { Page, Workout, MenuItem, StudioConfig, Passkategori } from '../types';
import { welcomeMessages } from '../data/welcomeMessages';

// HomeScreen Component
interface HomeScreenProps {
  navigateTo: (page: Page) => void;
  onSelectWorkout: (workout: Workout) => void;
  onSelectPasskategori: (passkategori: string) => void;
  savedWorkouts: Workout[];
  onCreateNewWorkout: () => void;
  onShowBoostModal: () => void;
  onCoachAccessRequest: () => void;
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
    onCoachAccessRequest, 
    studioConfig, 
    organizationLogoUrlLight,
    organizationLogoUrlDark,
    theme
}) => {
  const [welcomeMessage, setWelcomeMessage] = useState({ title: "Hej på er, kämpar!", subtitle: "Dags att svettas lite. 😉" });

  useEffect(() => {
    const today = new Date().toDateString();
    const storedMessageData = localStorage.getItem('dailyWelcomeMessage');
    
    if (storedMessageData) {
      try {
        const { message, date } = JSON.parse(storedMessageData);
        if (date === today) {
          setWelcomeMessage(message);
          return;
        }
      } catch (e) {
        console.error("Could not parse daily welcome message from localStorage", e);
      }
    }
    
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    const newMessage = welcomeMessages[randomIndex];
    setWelcomeMessage(newMessage);
    localStorage.setItem('dailyWelcomeMessage', JSON.stringify({ message: newMessage, date: today }));
    
  }, []);
  
  const menuItems = useMemo(() => {
    const items: (MenuItem & { passkategori?: Passkategori })[] = [];

    // Optional: Warmup
    if (studioConfig.enableWarmup) {
      items.push({ title: 'Uppvärmning', action: () => navigateTo(Page.Warmup) });
    }

    // Custom Categories
    studioConfig.customCategories.forEach(category => {
        items.push({ title: category.name, action: () => onSelectPasskategori(category.name), passkategori: category.name });
    });

    // Optional: Boost
    if (studioConfig.enableBoost) {
      items.push({ title: 'Dagens Boost', subTitle: '(20-30 minuters pass)', action: onShowBoostModal });
    }

    // Optional: HYROX
    if (studioConfig.enableHyrox) {
      items.push({ title: 'HYROX', action: () => navigateTo(Page.Hyrox) });
    }

    // Optional: Breathing Guide
    if (studioConfig.enableBreathingGuide) {
      items.push({ title: 'Andningsguide', action: () => navigateTo(Page.BreathingGuide) });
    }

    // Optional: Idea Board
    if (studioConfig.enableNotes) {
      items.push({ title: 'Idé-tavlan', action: () => navigateTo(Page.IdeaBoard) });
    }
    
    // --- Default items ---
    // FIX: Corrected typo from `FrestandingTimer` to `FreestandingTimer`.
    items.push({ title: 'Timer', action: () => navigateTo(Page.FreestandingTimer) });
    items.push({ title: 'Övriga Pass', action: () => navigateTo(Page.SavedWorkouts) });
    items.push({ title: 'För coacher', action: onCoachAccessRequest });
    
    return items.sort((a, b) => a.title.localeCompare(b.title, 'sv'));
  }, [studioConfig, navigateTo, onSelectPasskategori, onShowBoostModal, onCoachAccessRequest]);

  const logoUrl = theme === 'dark' 
    ? organizationLogoUrlDark || organizationLogoUrlLight 
    : organizationLogoUrlLight || organizationLogoUrlDark;


  return (
    <div className="w-full max-w-5xl mx-auto text-center">
      {logoUrl && (
          <div className="mb-12 flex justify-center">
              <img src={logoUrl} alt="Organisationslogotyp" className="max-h-40 max-w-md object-contain" />
          </div>
      )}
      <h2 className="text-3xl text-gray-900 dark:text-white mb-4 font-bold">{welcomeMessage.title}</h2>
      <p className="text-xl text-primary dark:brightness-110 mb-12">{`“${welcomeMessage.subtitle}”`}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {menuItems.map((item) => {
            return (
              <div key={item.title} className="relative group">
                <button
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`${item.colorClass || 'bg-primary hover:brightness-95'} w-full text-white font-bold h-32 sm:h-36 lg:h-40 px-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center text-2xl shadow-lg disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed`}
                >
                  <span>{item.title}</span>
                  {item.subTitle && <span className="text-sm font-normal text-white/70 mt-1">{item.subTitle}</span>}
                </button>
              </div>
            )
        })}
      </div>
    </div>
  );
};