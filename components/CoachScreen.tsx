








import React from 'react';
import { Page, MenuItem, CustomPage } from '../types';
import { useStudio } from '../context/StudioContext';

// CoachScreen Component
interface CoachScreenProps {
  userLevel: 'member' | 'coach' | 'superadmin' | 'systemowner';
  navigateTo: (page: Page) => void;
  onSelectCustomPage: (page: CustomPage) => void;
  onSuperAdminAccessRequest: () => void;
  onSystemOwnerAccessRequest: () => void;
}

export const CoachScreen: React.FC<CoachScreenProps> = ({ userLevel, navigateTo, onSelectCustomPage, onSuperAdminAccessRequest, onSystemOwnerAccessRequest }) => {
  const { selectedStudio, selectedOrganization } = useStudio();

  // Static, high-fidelity pages get top priority
  const staticMenuItems: MenuItem[] = [
    { title: 'Pass & Program', action: () => navigateTo(Page.AIGenerator) },
    { title: 'Startprogram', action: () => navigateTo(Page.StartProgram) },
    { title: 'Checklista', action: () => navigateTo(Page.Checklist) },
    { title: 'Grundläggande Kost', action: () => navigateTo(Page.BasicNutrition) },
  ];

  // Dynamically add any other custom pages created by the admin
  const dynamicCustomPages: MenuItem[] = (selectedOrganization?.customPages || []).map(page => ({
      title: page.title,
      action: () => onSelectCustomPage(page)
  }));
  
  const adminMenuItems: MenuItem[] = [
      { title: 'Konfigurera Studio', action: () => navigateTo(Page.AdminConfig), disabled: !selectedStudio, colorClass: 'bg-blue-600 hover:bg-blue-500' },
      { title: 'Byt Aktiv Studio', action: () => navigateTo(Page.StudioSelection), colorClass: 'bg-gray-600 hover:bg-gray-500' }
  ];

  // --- Role-based Access Buttons ---
  if (userLevel === 'coach') {
      adminMenuItems.push({ 
          title: 'Organisationsadmin', 
          action: onSuperAdminAccessRequest, 
          disabled: !selectedOrganization,
          colorClass: 'bg-purple-700 hover:bg-purple-600' 
      });
  }

  if (userLevel === 'superadmin') {
      adminMenuItems.push({ 
          title: 'Organisationsadmin', 
          action: () => navigateTo(Page.SuperAdmin), 
          disabled: !selectedOrganization, 
          colorClass: 'bg-purple-700 hover:bg-purple-600' 
      });
      adminMenuItems.push({ 
          title: 'Systemägare', 
          action: onSystemOwnerAccessRequest, 
          colorClass: 'bg-yellow-600 hover:bg-yellow-500' 
      });
  }

  if (userLevel === 'systemowner') {
      adminMenuItems.push({ 
          title: 'Organisationsadmin', 
          action: () => navigateTo(Page.SuperAdmin), 
          disabled: !selectedOrganization,
          colorClass: 'bg-purple-700 hover:bg-purple-600'
      });
      adminMenuItems.push({ 
          title: 'Systemägare', 
          action: () => navigateTo(Page.SystemOwner), 
          colorClass: 'bg-yellow-600 hover:bg-yellow-500'
      });
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