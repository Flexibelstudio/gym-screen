
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
    CloseIcon,
    DumbbellIcon
} from './icons';

const UsersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
);

interface CoachScreenProps {
  role: UserRole;
  navigateTo: (page: Page) => void;
  onSelectCustomPage: (page: CustomPage) => void;
  isImpersonating?: boolean;
  onReturnToAdmin?: () => void;
  onAdminLogin?: () => void;
  onMemberProfileRequest?: () => void;
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

export const CoachScreen: React.FC<CoachScreenProps> = ({ role, navigateTo, onSelectCustomPage, isImpersonating, onReturnToAdmin, onAdminLogin, onMemberProfileRequest }) => {
  const { selectedStudio, selectedOrganization, studioConfig } = useStudio();
  const { isStudioMode, signOut, clearDeviceProvisioning } = useAuth();

  const items: { title: string; subTitle?: string; action: () => void; icon: React.ReactNode; gradient: string }[] = [];

  // 1. DIN TRÄNING & MEDLEMSREGISTER
  // Vi visar alltid profilen och registret för personalroller
  items.push({ 
      title: 'Min Träning', 
      subTitle: 'Se statistik & mål',
      action: onMemberProfileRequest || (() => navigateTo(Page.MemberProfile)),
      icon: <UserIcon className="w-8 h-8" />,
      gradient: 'bg-gradient-to-br from-teal-500 to-emerald-700'
  });

  items.push({ 
      title: 'Medlemsregister', 
      subTitle: 'Hantera medlemmar',
      action: () => navigateTo(Page.MemberRegistry),
      icon: <UsersIcon className="w-8 h-8" />,
      gradient: 'bg-gradient-to-br from-emerald-600 to-teal-800'
  });

  // 2. CONTENT FOR ALL COACHES (Infosidor)
  (selectedOrganization?.customPages || []).forEach(page => {
      items.push({
          title: page.title,
          subTitle: 'Information & Guider',
          action: () => onSelectCustomPage(page),
          icon: <DocumentTextIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-primary to-teal-800'
      });
  });

  // 3. HIERARCHY LOGIC
  if (isImpersonating) {
      items.push({ 
          title: 'Återgå till Admin', 
          subTitle: 'Avsluta förhandsvisning',
          action: onReturnToAdmin!,
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-gray-700 to-gray-900'
      });
  } else if (isStudioMode) {
      items.push({
          title: 'Logga in Admin',
          subTitle: 'För system & inställningar',
          action: onAdminLogin || (() => {}),
          icon: <SettingsIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-indigo-600 to-purple-800'
      });

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
      if (role === 'systemowner') {
          items.push({ 
              title: 'Systemägare', 
              subTitle: 'Hantera alla organisationer',
              action: () => navigateTo(Page.SystemOwner), 
              icon: <SettingsIcon className="w-8 h-8" />,
              gradient: 'bg-gradient-to-br from-gray-800 to-black'
          });
      }

      items.push({ 
          title: role === 'organizationadmin' ? 'Adminpanel' : 'Studiohantering', 
          subTitle: 'Inställningar & Pass',
          action: () => navigateTo(Page.SuperAdmin),
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-blue-600 to-indigo-900'
      });

      items.push({
          title: 'Logga ut',
          subTitle: 'Avsluta session',
          action: () => signOut(),
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
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
