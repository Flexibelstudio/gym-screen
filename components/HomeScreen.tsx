

import React, { useState, useEffect, useMemo } from 'react';
import { Page, Workout, MenuItem, StudioConfig, WorkoutCategory } from '../types';
import { welcomeMessages } from '../data/welcomeMessages';

// HomeScreen Component
interface HomeScreenProps {
  navigateTo: (page: Page) => void;
  onSelectWorkout: (workout: Workout) => void;
  onSelectCategory: (category: string) => void;
  savedWorkouts: Workout[];
  onCreateNewWorkout: () => void;
  onShowBoostModal: () => void;
  onCoachAccessRequest: () => void;
  studioConfig: StudioConfig;
  organizationLogoUrl?: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigateTo, onSelectWorkout, onSelectCategory, savedWorkouts, onCreateNewWorkout, onShowBoostModal, onCoachAccessRequest, studioConfig, organizationLogoUrl }) => {
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
    const items: MenuItem[] = [];

    // Optional: Warmup
    if (studioConfig.enableWarmup) {
      items.push({ title: 'Uppvärmning', action: () => navigateTo(Page.Warmup) });
    }

    // Custom Categories
    studioConfig.customCategories.forEach(category => {
        items.push({ title: category.name, action: () => onSelectCategory(category.name) });
    });

    // Optional: Boost
    if (studioConfig.enableBoost) {
      items.push({ title: 'Dagens Boost', subTitle: '(20-30 minuters pass)', action: onShowBoostModal });
    }

    // Optional: Breathing Guide
    if (studioConfig.enableBreathingGuide) {
      items.push({ title: 'Andningsguide', action: () => navigateTo(Page.BreathingGuide) });
    }

    // --- Default items ---
    items.push({ title: 'Fristående Timer', action: () => navigateTo(Page.FreestandingTimer) });
    items.push({ title: 'Skapa Eget Pass', action: onCreateNewWorkout });
    items.push({ title: 'Mina Utkast', action: () => navigateTo(Page.SavedWorkouts) });
    items.push({ title: 'För coacher', action: onCoachAccessRequest });
    
    return items;
  }, [studioConfig, navigateTo, onSelectCategory, onShowBoostModal, onCreateNewWorkout, onCoachAccessRequest]);


  return (
    <div className="w-full max-w-5xl mx-auto text-center">
      {organizationLogoUrl && (
          <div className="mb-8 flex justify-center">
              <img src={organizationLogoUrl} alt="Organisationslogotyp" className="max-h-20 max-w-xs object-contain" />
          </div>
      )}
      <h2 className="text-3xl text-gray-900 dark:text-white mb-2 font-bold">{welcomeMessage.title}</h2>
      <p className="text-xl text-primary dark:brightness-110 mb-10">{`“${welcomeMessage.subtitle}”`}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {menuItems.map((item: MenuItem) => (
          <button
            key={item.title}
            onClick={item.action}
            disabled={item.disabled}
            className={`${item.colorClass || 'bg-primary hover:brightness-95'} text-white font-bold h-24 sm:h-28 lg:h-32 px-4 rounded-lg transition-all duration-300 flex flex-col items-center justify-center text-xl shadow-lg disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed`}
          >
            <span>{item.title}</span>
            {item.subTitle && <span className="text-xs font-normal text-white/70 mt-1">{item.subTitle}</span>}
          </button>
        ))}
      </div>
    </div>
  );
};