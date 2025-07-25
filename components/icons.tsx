import React from 'react';

// All icon components have been removed as per user request to use only words.

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