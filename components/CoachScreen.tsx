import React from 'react';
import { Page, MenuItem, CustomPage, UserRole } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';

interface CoachScreenProps {
  role: UserRole;
  navigateTo: (page: Page) => void;
  onSelectCustomPage: (page: CustomPage) => void;
  isImpersonating?: boolean;
  onReturnToAdmin?: () => void;
}

export const CoachScreen: React.FC<CoachScreenProps> = ({ role, navigateTo, onSelectCustomPage, isImpersonating, onReturnToAdmin }) => {
  const { selectedStudio, selectedOrganization } = useStudio();
  const { isStudioMode, signOut } = useAuth();

  const staticMenuItems: MenuItem[] = [
    { title: 'Pass & Program', action: () => navigateTo(Page.AIGenerator) },
    { title: 'Startprogram', action: () => navigateTo(Page.StartProgram) },
    { title: 'Checklista', action: () => navigateTo(Page.Checklist) },
    { title: 'Grundläggande Kost', action: () => navigateTo(Page.BasicNutrition) },
  ];

  const dynamicCustomPages: MenuItem[] = (selectedOrganization?.customPages || []).map(page => ({
      title: page.title,
      action: () => onSelectCustomPage(page)
  }));
  
  const adminMenuItems: MenuItem[] = [];
  
  // If in studio mode, add a button to exit it. This allows returning to the login/setup screen.
  if (isStudioMode && !isImpersonating) { // Don't show if impersonating, they have another way back
      adminMenuItems.push({
          title: 'Avsluta Studioläge',
          action: () => {
              if (window.confirm("Är du säker på att du vill avsluta studioläget? Detta loggar ut enheten.")) {
                  signOut();
              }
          },
          colorClass: 'bg-red-700 hover:bg-red-600'
      });
  }

  // The "Byt aktiv studio" button is not included as per user request to prevent direct studio switching.

  if (isImpersonating) {
      adminMenuItems.unshift({ 
          title: 'Återgå till Admin', 
          action: onReturnToAdmin!,
          colorClass: 'bg-purple-700 hover:bg-purple-600' 
      });
  } else {
      if (role === 'organizationadmin') {
          adminMenuItems.unshift({ 
              title: 'Organisationsadmin', 
              action: () => navigateTo(Page.SuperAdmin),
              colorClass: 'bg-purple-700 hover:bg-purple-600' 
          });
      }

      if (role === 'systemowner') {
           adminMenuItems.unshift({ 
              title: 'Systemägare', 
              action: () => navigateTo(Page.SystemOwner), 
              colorClass: 'bg-yellow-600 hover:bg-yellow-500'
          });
      }
  }


  const allMenuItems = [...staticMenuItems, ...dynamicCustomPages, ...adminMenuItems];
  
  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-10">För Coacher</h1>
       <div className="text-gray-400 mb-6 -mt-4 text-center">
            <p>Organisation: <span className="font-bold text-white">{selectedOrganization?.name || 'Ingen vald'}</span></p>
            <p>Studio: <span className="font-bold text-white">{selectedStudio?.name || 'Ingen vald'}</span></p>
       </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {allMenuItems.map(item => (
          <button
            key={item.title}
            onClick={item.action}
            disabled={item.disabled}
            className={`${item.colorClass || 'bg-primary hover:brightness-95'} text-white font-bold h-32 px-6 rounded-lg transition-all duration-300 flex flex-col items-center justify-center text-xl shadow-lg disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed`}
          >
            <span>{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}