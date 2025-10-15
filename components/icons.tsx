

import React from 'react';

export const StarIcon: React.FC<{className?: string, filled?: boolean}> = ({className = "h-6 w-6", filled = false}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
);


export const ValueAdjuster: React.FC<{
  label: string;
  value: number;
  onchange: (newValue: number) => void;
  min?: number;
  max?: number;
  step?: number;
  wrapAround?: boolean;
  onWrap?: (direction: 'up' | 'down') => void;
}> = ({ label, value, onchange, min = 0, max = 99, step = 1, wrapAround = false, onWrap }) => {
  const increment = () => {
    const newValue = value + step;
    if (wrapAround && newValue > max) {
      // Handles wrapping for things like seconds -> minutes
      onchange(min + (newValue - (max + 1))); 
      if (onWrap) onWrap('up');
    } else {
      onchange(Math.min(max, newValue));
    }
  };

  const decrement = () => {
    const newValue = value - step;
    if (wrapAround && newValue < min) {
      // Handles wrapping for things like seconds -> minutes
      onchange(max - (min - newValue - 1));
      if (onWrap) onWrap('down');
    } else {
      onchange(Math.max(min, newValue));
    }
  };

  return (
    <div className="text-center">
      <label className="block text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-4">
        <button
          onClick={decrement}
          className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md w-12 h-12 flex items-center justify-center text-3xl font-bold transition-colors text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary ring-offset-2 ring-offset-white dark:ring-offset-black"
          aria-label={`Minska ${label}`}
        >
          -
        </button>
        <span className="font-mono text-5xl font-bold text-gray-900 dark:text-white w-20 text-center" style={{fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 3px rgba(0,0,0,0.4)'}}>
          {String(value).padStart(2, '0')}
        </span>
        <button
          onClick={increment}
          className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-md w-12 h-12 flex items-center justify-center text-3xl font-bold transition-colors text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary ring-offset-2 ring-offset-white dark:ring-offset-black"
          aria-label={`Öka ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between cursor-pointer w-full p-2 rounded-lg hover:bg-gray-500/10 transition-colors">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="w-14 h-8 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-primary transition-colors"></div>
            <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform peer-checked:translate-x-6"></div>
        </div>
    </label>
);

export const HomeIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

export const DocumentTextIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

export const SpeakerphoneIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-2.236 9.168-5.514C18.332 18.285 18 20 16 20c-1.833 0-3.001-1.318-3.001-2.5 0-1.012.787-1.84 1.76-2.022M7 7h1.832a4.001 4.001 0 004.764-2.824 2.953 2.953 0 00-2.824-2.824 2.953 2.953 0 00-2.824 2.824A4.001 4.001 0 007 7z" />
    </svg>
);

export const SparklesIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

export const UsersIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1H9M15 21a2 2 0 002-2v-1a2 2 0 00-2-2h-3a2 2 0 00-2 2v1a2 2 0 002 2h3zm4-12a2 2 0 002-2V7a2 2 0 00-2-2h-3a2 2 0 00-2 2v1a2 2 0 002 2h3z" />
    </svg>
);

export const PencilIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

export const DumbbellIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
       <path strokeLinecap="round" strokeLinejoin="round" d="M8 6.75V5.25a2.25 2.25 0 0 1 2.25-2.25h3a2.25 2.25 0 0 1 2.25 2.25v1.5M4.5 9.75v10.5a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25V9.75" />
    </svg>
);

export const BriefcaseIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

export const QuestionMarkCircleIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const PaperAirplaneIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);

export const InformationCircleIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const CloseIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const UploadIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);