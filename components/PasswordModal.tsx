
import React, { useState } from 'react';
import { Organization } from '../types';

interface PasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  coachPassword?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ onClose, onSuccess, coachPassword }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password === coachPassword) {
      setError('');
      onSuccess();
    } else {
      setError('Fel lösenord. Försök igen.');
      setPassword('');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
      <div 
        className="bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-sm text-white shadow-2xl border border-gray-700 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="password-modal-title" className="text-2xl font-bold mb-4">Coach-åtkomst</h2>
          <p className="text-gray-300 mb-6">
            Ange lösenordet för att komma åt coach-sektionen.
          </p>
          <div>
            <label htmlFor="password-input" className="sr-only">Lösenord</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-gray-900 text-white p-3 rounded-md border border-gray-600 focus:ring-2 focus:ring-primary focus:outline-none transition font-semibold text-center text-lg tracking-widest"
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 mt-3 text-sm text-center">{error}</p>}
          <div className="mt-6 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors">
              Avbryt
            </button>
            <button type="submit" className="flex-1 bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors">
              Logga in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
