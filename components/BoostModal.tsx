import React from 'react';

interface BoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDifficulty: (difficulty: 'enkel' | 'avancerad') => void;
}

export const BoostModal: React.FC<BoostModalProps> = ({ isOpen, onClose, onSelectDifficulty }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-lg text-white shadow-2xl border border-gray-700 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-3xl font-bold">
                <span>Dagens Boost</span>
            </h2>
            <button onClick={onClose} className="font-semibold text-gray-400 hover:text-white transition-colors">Stäng</button>
        </div>
        
        <p className="text-gray-300 mb-8">
            Välj en svårighetsgrad för att få ett slumpmässigt utvalt, snabbt och effektivt pass (20-30 min). Perfekt när du vill ha en snabb endorfinkick!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
                onClick={() => onSelectDifficulty('enkel')}
                className="bg-primary hover:brightness-95 text-white font-bold h-40 rounded-lg transition-colors duration-200 flex flex-col items-center justify-center text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary"
            >
                <h3 className="font-extrabold">Enkel WOD</h3>
                <p className="text-sm font-normal text-white/70 mt-1">Kroppsvikt & KB</p>
            </button>
            <button 
                onClick={() => onSelectDifficulty('avancerad')}
                className="bg-red-600 hover:bg-red-500 text-white font-bold h-40 rounded-lg transition-colors duration-200 flex flex-col items-center justify-center text-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-400"
            >
                <h3 className="font-extrabold">Avancerad WOD</h3>
                <p className="text-sm font-normal text-white/70 mt-1">CrossFit-stil</p>
            </button>
        </div>
      </div>
    </div>
  );
};