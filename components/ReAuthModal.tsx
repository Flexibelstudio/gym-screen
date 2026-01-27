import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { CloseIcon, UserIcon } from './icons';

interface ReAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const ReAuthModal: React.FC<ReAuthModalProps> = ({ onClose, onSuccess }) => {
  const { reauthenticate, userData } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAuthenticating(true);

    try {
      await reauthenticate(password);
      onSuccess();
    } catch (err) {
      console.error("Re-authentication failed", err);
      setError('Fel lösenord. Försök igen.');
      setPassword('');
    } finally {
        setIsAuthenticating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-[1000] p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="reauth-modal-title">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 sm:p-10 w-full max-w-md text-gray-900 dark:text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 relative"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
          disabled={isAuthenticating}
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-6 border-4 border-white dark:border-gray-900 shadow-lg shrink-0">
              {userData?.photoUrl ? (
                  <img src={userData.photoUrl} className="w-full h-full object-cover" alt="" />
              ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <UserIcon className="w-10 h-10" />
                  </div>
              )}
          </div>
          
          <h2 id="reauth-modal-title" className="text-2xl font-black mb-2 uppercase tracking-tight">Verifiera för admin</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm font-medium leading-relaxed">
            Hej {userData?.firstName || 'vän'}! Ange ditt personliga lösenord för att få åtkomst till de administrativa inställningarna.
          </p>

          <div className="w-full">
            <label htmlFor="reauth-password-input" className="sr-only">Lösenord</label>
            <input
              id="reauth-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Ditt lösenord"
              className="w-full bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-4 rounded-2xl border-2 border-gray-100 dark:border-gray-800 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all font-bold text-center text-xl"
              autoFocus
              disabled={isAuthenticating}
            />
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

          <div className="mt-10 flex flex-col gap-3 w-full">
            <button 
              type="submit" 
              disabled={isAuthenticating || !password}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black py-4 rounded-2xl shadow-xl transition-all transform active:scale-95 text-lg uppercase tracking-widest disabled:opacity-50"
            >
              {isAuthenticating ? 'Bekräftar...' : 'Verifiera & Fortsätt'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isAuthenticating}
              className="w-full text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold py-2 transition-colors uppercase tracking-widest text-[10px]"
            >
              Avbryt
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};