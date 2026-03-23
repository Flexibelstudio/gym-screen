import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CloseIcon, LockClosedIcon, EyeIcon, EyeOffIcon } from './icons';

interface PasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  coachPassword?: string;
  onLogout?: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ onClose, onSuccess, coachPassword, onLogout }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password === coachPassword) {
      setError('');
      onSuccess();
    } else {
      setError('Fel lösenord. Försök igen.');
      setFailedAttempts(prev => prev + 1);
      setPassword('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-[1000] p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md text-gray-900 dark:text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-inner">
            <LockClosedIcon className="w-8 h-8" />
          </div>
          
          <h2 id="password-modal-title" className="text-3xl font-black mb-2 uppercase tracking-tight">Coach-åtkomst</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
            Ange gymmets lösenord för att låsa upp coach-verktygen på den här skärmen.
          </p>

          <div className="w-full relative">
            <label htmlFor="password-input" className="sr-only">Lösenord</label>
            <input
              id="password-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••"
              className="w-full bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-5 pr-14 rounded-2xl border-2 border-gray-100 dark:border-gray-800 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all font-black text-center text-3xl tracking-[0.5em] placeholder-gray-300 dark:placeholder-gray-700"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
            >
              {showPassword ? <EyeOffIcon className="w-7 h-7" /> : <EyeIcon className="w-7 h-7" />}
            </button>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 mt-4 font-bold text-sm"
            >
              {error}
            </motion.p>
          )}

          <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full">
            <button 
              type="submit" 
              className="flex-[2] bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-widest"
            >
              Lås upp
            </button>
            <div className="flex flex-1 gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold py-4 rounded-2xl transition-colors uppercase tracking-widest text-xs"
              >
                Avbryt
              </button>
              {failedAttempts > 0 && onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="flex-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 font-bold py-4 rounded-2xl transition-colors uppercase tracking-widest text-xs"
                >
                  Logga ut
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};