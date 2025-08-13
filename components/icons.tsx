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
        <span className="font-mono text-5xl font-bold text-black dark:text-white w-20 text-center" style={{fontVariantNumeric: 'tabular-nums'}}>
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