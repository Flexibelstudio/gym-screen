import React from 'react';
import { Page, CustomPage, UserRole } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { 
    DocumentTextIcon, 
    BriefcaseIcon, 
    SettingsIcon, 
    UserIcon,
    CloseIcon
} from './icons';

// Enkel fallback-ikon för Users om du inte har den importerad i icons.ts
const UsersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="12" y1="22" x2="12" y2="22.01"></line><line x1="12" y1="2" x2="12" y2="4"></line><line x1="8" y1="6" x2="8" y2="6.01"></line><line x1="16" y1="6" x2="16" y2="6.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line>
    </svg>
);

interface CoachScreenProps {
  role: UserRole;
  navigateTo: (page: Page) => void;
  onSelectCustomPage: (page: CustomPage) => void;
  isImpersonating?: boolean;
  onReturnToAdmin?: () => void;
  onAdminLogin?: () => void;
}

const CoachCard: React.FC<{
    title: string;
    subTitle?: string;
    onClick: () => void;
    icon: React.ReactNode;
    gradient: string;
    delay: number;
}> = ({ title, subTitle, onClick, icon, gradient, delay }) => (
    <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay }}
        whileHover={{ scale: 1.02, y: -5 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`
            relative overflow-hidden group rounded-3xl p-6 text-left h-48 w-full
            ${gradient} text-white shadow-xl border border-white/10
            flex flex-col justify-between transition-all
        `}
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none mix-blend-overlay"></div>
        <div className="bg-white/20 w-fit p-3 rounded-2xl backdrop-blur-sm shadow-inner">
            {icon}
        </div>
        <div>
            <h3 className="text-2xl font-bold tracking-tight leading-tight">{title}</h3>
            {subTitle && (
                <p className="text-white/80 text-sm font-medium mt-1">{subTitle}</p>
            )}
        </div>
    </motion.button>
);

export const CoachScreen: React.FC<CoachScreenProps> = ({ role, navigateTo, onSelectCustomPage, isImpersonating, onReturnToAdmin, onAdminLogin }) => {
  const { selectedStudio, selectedOrganization } = useStudio();
  const { isStudioMode, signOut, clearDeviceProvisioning } = useAuth();

  const items: { title: string; subTitle?: string; action: () => void; icon: React.ReactNode; gradient: string }[] = [];

  // 1. CONTENT FOR ALL COACHES (Shared Password & Personal Login)
  
  // Infosidor (Dynamiska)
  (selectedOrganization?.customPages || []).forEach(page => {
      items.push({
          title: page.title,
          subTitle: 'Information & Guider',
          action: () => onSelectCustomPage(page),
          icon: <DocumentTextIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-primary to-teal-800'
      });
  });

  // --- NYHET: Medlemsregister ---
  items.push({ 
      title: 'Medlemsregister', 
      subTitle: 'Hantera medlemmar',
      action: () => navigateTo(Page.MemberRegistry),
      icon: <UsersIcon className="w-8 h-8" />,
      gradient: 'bg-gradient-to-br from-emerald-600 to-teal-800'
  });

  // 2. HIERARCHY LOGIC

  if (isImpersonating) {
      // Case A: Admin previewing as Studio/Member -> Return to Admin
      items.push({ 
          title: 'Återgå till Admin', 
          subTitle: 'Avsluta förhandsvisning',
          action: onReturnToAdmin!,
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-gray-700 to-gray-900'
      });
  } else if (isStudioMode) {
      // Case B: Shared Password Mode (Studio View) -> Login to get more access
      items.push({
          title: 'Logga in Admin',
          subTitle: 'För system & inställningar',
          action: onAdminLogin || (() => {}), // Fallback if undefined
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-indigo-600 to-purple-800'
      });

      // Studio Management (Logout/Reset device)
      items.push({
          title: 'Byt Studio / Nollställ',
          subTitle: 'Logga ut enheten',
          action: () => {
              if (window.confirm("Vill du nollställa denna enhet? Detta tar bort låset till studion och loggar ut.")) {
                  clearDeviceProvisioning();
                  signOut();
              }
          },
          icon: <CloseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
      });

  } else {
      // Case C: Personally Logged In (Admin or Personal Coach Account)
      
      if (role === 'systemowner') {
          items.push({ 
              title: 'Systemägare', 
              subTitle: 'Hantera alla organisationer',
              action: () => navigateTo(Page.SystemOwner), 
              icon: <SettingsIcon className="w-8 h-8" />,
              gradient: 'bg-gradient-to-br from-gray-800 to-black'
          });
      }

      // Access to Admin Panel
      items.push({ 
          title: role === 'organizationadmin' ? 'Adminpanel' : 'Studiohantering', 
          subTitle: 'Inställningar & Pass',
          action: () => navigateTo(Page.SuperAdmin),
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-blue-600 to-indigo-900'
      });

      // Personal Logout
      items.push({
          title: 'Logga ut',
          subTitle: 'Avsluta session',
          action: () => signOut(),
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
      });
  }

  // Always show Studio Selection if not locked (good for navigation)
  if (!isStudioMode && !isImpersonating && items.length < 6) {
       items.push({
          title: 'Välj Studio',
          subTitle: 'Byt aktiv skärm',
          action: () => navigateTo(Page.StudioSelection),
          icon: <BuildingIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-orange-500 to-red-600'
      });
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
              För Coacher & Personal
          </h1>
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-8 bg-gray-100 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Organisation</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedOrganization?.name || 'Ingen vald'}</span>
              </div>
              <div className="hidden sm:block w-px h-10 bg-gray-300 dark:bg-gray-600"></div>
              <div className="text-left">
                  <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Studio / Skärm</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{selectedStudio?.name || 'Ingen vald'}</span>
              </div>
          </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, index) => (
            <CoachCard 
                key={item.title + index}
                {...item}
                onClick={item.action}
                delay={index * 0.1}
            />
        ))}
      </div>
    </div>
  );
}