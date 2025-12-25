
import React from 'react';
import { Page, MenuItem, CustomPage, UserRole } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { 
    DocumentTextIcon, 
    BriefcaseIcon, 
    SettingsIcon, 
    HomeIcon, 
    UserIcon,
    CloseIcon 
} from './icons';

interface CoachScreenProps {
  role: UserRole;
  navigateTo: (page: Page) => void;
  onSelectCustomPage: (page: CustomPage) => void;
  isImpersonating?: boolean;
  onReturnToAdmin?: () => void;
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

export const CoachScreen: React.FC<CoachScreenProps> = ({ role, navigateTo, onSelectCustomPage, isImpersonating, onReturnToAdmin }) => {
  const { selectedStudio, selectedOrganization } = useStudio();
  const { isStudioMode, signOut, clearDeviceProvisioning } = useAuth();

  const items: { title: string; subTitle?: string; action: () => void; icon: React.ReactNode; gradient: string }[] = [];

  (selectedOrganization?.customPages || []).forEach(page => {
      items.push({
          title: page.title,
          subTitle: 'Information & Guider',
          action: () => onSelectCustomPage(page),
          icon: <DocumentTextIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-primary to-teal-800'
      });
  });

  if (isImpersonating) {
      items.push({ 
          title: 'Återgå till Admin', 
          subTitle: 'Avsluta förhandsvisning',
          action: onReturnToAdmin!,
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-gray-700 to-gray-900'
      });
  } else if (role === 'systemowner') {
      items.push({ 
          title: 'Systemägare', 
          subTitle: 'Hantera alla organisationer',
          action: () => navigateTo(Page.SystemOwner), 
          icon: <SettingsIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-indigo-600 to-purple-800'
      });
  } else if (role === 'organizationadmin') {
      items.push({ 
          title: 'Adminpanel', 
          subTitle: 'Inställningar & Pass',
          action: () => navigateTo(Page.SuperAdmin),
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-blue-600 to-indigo-900'
      });
  }

  if (isStudioMode && !isImpersonating) {
      items.push({
          title: 'Nollställ skärm',
          subTitle: 'Logga ut & rensa lås',
          action: () => {
              if (window.confirm("Vill du nollställa denna enhet? Detta tar bort låset till studion och loggar ut.")) {
                  clearDeviceProvisioning();
                  signOut();
              }
          },
          icon: <CloseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
      });
  } else if (!isStudioMode && !isImpersonating) {
       items.push({
          title: 'Logga ut',
          action: () => signOut(),
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
      });
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-6">
              För Coacher
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
