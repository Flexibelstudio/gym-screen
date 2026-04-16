

import React, { useState } from 'react';
import { Page, CustomPage, UserRole } from '../types';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';
import { 
    DocumentTextIcon, 
    BriefcaseIcon, 
    SettingsIcon, 
    UserIcon,
    CloseIcon,
    DumbbellIcon,
    SparklesIcon,
    ChartBarIcon,
    LightningIcon // Used for Remote Control icon
} from './icons';

interface CoachScreenProps {
  role: UserRole;
  isStudioMode?: boolean;
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
    isLocked?: boolean;
}> = ({ title, subTitle, onClick, icon, gradient, delay, isLocked }) => (
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
        {isLocked && (
            <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            </div>
        )}
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
  const { selectedStudio, selectedOrganization } = useStudio();
  const { isStudioMode, signOut, clearDeviceProvisioning } = useAuth();
  const [showLockedModal, setShowLockedModal] = useState(false);

  const items: { title: string; subTitle?: string; action: () => void; icon: React.ReactNode; gradient: string; isLocked?: boolean }[] = [];

  // 1. DIN TRÄNING (Visa inte i StudioMode)
  if (!isStudioMode) {
      items.push({ 
          title: 'Min Träning', 
          subTitle: 'Se statistik & mål',
          action: onMemberProfileRequest || (() => navigateTo(Page.MemberProfile)),
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-teal-500 to-emerald-700'
      });

      // NYTT: Anteckningar
      items.push({
          title: 'Anteckningar',
          subTitle: 'Spara pass & idéer',
          action: () => navigateTo(Page.CoachNotes),
          icon: <DocumentTextIcon className="w-8 h-8" />,
          gradient: 'bg-primary bg-gradient-to-br from-primary via-primary to-indigo-800'
      });
  }

  // 2. LOGIK FÖR ADMIN / MANAGEMENT
  if (isImpersonating) {
      // Om vi förhandsgranskar vyn från adminpanelen
      items.push({ 
          title: 'Återgå till Admin', 
          subTitle: 'Avsluta förhandsvisning',
          action: onReturnToAdmin!,
          icon: <BriefcaseIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-gray-700 to-gray-900'
      });
  } else if (isStudioMode) {
      // Om vi är på en fast skärm i gymmet
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
      // Om vi navigerar från personlig profil (Web/Mobil)
      
      // NYTT: REMOTE CONTROL
      // Bara för coacher/admins på personliga enheter (inte TV-skärmar)
      if (role === 'coach' || role === 'organizationadmin' || role === 'systemowner') {
          items.push({
              title: 'Mobilstyrning',
              subTitle: 'Styr skärmen med din mobil',
              action: () => navigateTo(Page.RemoteControl),
              icon: <LightningIcon className="w-8 h-8" />,
              gradient: 'bg-gradient-to-br from-orange-500 to-amber-600'
          });

          items.push({
              title: 'Studiovy',
              subTitle: 'Se och starta pass',
              action: () => navigateTo(Page.Home),
              icon: <DumbbellIcon className="w-8 h-8" />,
              gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600'
          });
      }

      if (role === 'systemowner') {
          items.push({ 
              title: 'Systemägare', 
              subTitle: 'Hantera alla organisationer',
              action: () => navigateTo(Page.SystemOwner), 
              icon: <SettingsIcon className="w-8 h-8" />,
              gradient: 'bg-gradient-to-br from-gray-800 to-black'
          });
      }

      // Konsoliderad Admin-knapp för admins, Coachadmin för coacher
      const isAdmin = role === 'organizationadmin' || role === 'systemowner';
      items.push({ 
          title: isAdmin ? 'Admin' : 'Coachadmin', 
          subTitle: isAdmin ? 'Hantera studio & pass' : 'Skapa & hantera pass',
          action: () => navigateTo(Page.SuperAdmin),
          icon: isAdmin ? <BriefcaseIcon className="w-8 h-8" /> : <DumbbellIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-blue-600 to-indigo-700'
      });

      items.push({
          title: 'Logga ut',
          subTitle: 'Avsluta session',
          action: () => signOut(),
          icon: <UserIcon className="w-8 h-8" />,
          gradient: 'bg-gradient-to-br from-red-500 to-red-800'
      });
  }

  // 3. INFOSIDOR (Content for all staff)
  (selectedOrganization?.customPages || []).forEach(page => {
      items.push({
          title: page.title,
          subTitle: 'Information & Guider',
          action: () => onSelectCustomPage(page),
          icon: <DocumentTextIcon className="w-8 h-8" />,
          gradient: 'bg-primary bg-gradient-to-br from-white/20 via-transparent to-black/30'
      });
  });

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

      <Modal isOpen={showLockedModal} onClose={() => setShowLockedModal(false)} title="Lås upp People Hub 🚀" size="lg">
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-3xl text-white text-center shadow-xl">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                    <SparklesIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Världens modernaste medlemsupplevelse</h3>
                <p className="text-indigo-100 leading-relaxed">
                    Denna funktion ingår i tilläggstjänsten <strong>Smart Medlemsupplevelse</strong>.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4 text-primary" />
                        För Coachen
                    </h4>
                    <ul className="text-xs text-gray-500 space-y-2">
                        <li>• Full översikt över alla medlemmar</li>
                        <li>• Se personbästa och träningsmål</li>
                        <li>• AI-genererad analys av framsteg</li>
                    </ul>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-purple-500" />
                        För Medlemmen
                    </h4>
                    <ul className="text-xs text-gray-500 space-y-2">
                        <li>• Logga pass direkt via QR-kod</li>
                        <li>• Personlig AI-strategi inför passet</li>
                        <li>• Träningsdagbok i mobilen</li>
                    </ul>
                </div>
            </div>

            <button 
                onClick={() => setShowLockedModal(false)}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
            >
                Jag förstår
            </button>
        </div>
      </Modal>
    </div>
  );
}
