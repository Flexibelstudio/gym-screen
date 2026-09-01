import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { auth, functionsEurope } from '../services/firebaseService';
import { motion } from 'framer-motion';
import { CloseIcon, LockClosedIcon, EyeIcon, EyeOffIcon } from './icons';

interface PasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  organizationId?: string;
  onLogout?: () => void;
  /** Rubrik och brödtext kan skrivas över när samma grind används i ett annat sammanhang. */
  title?: string;
  description?: string;
}

/**
 * Igenkänningsmärke av koden — inte koden själv. Går inte att läsa baklänges.
 * Gör att en skärm som en gång fått ja av servern kan släppa in samma kod
 * direkt, utan väntan och även på svajigt nät. Servern förblir facit via
 * dubbelkollen i bakgrunden.
 */
const kodMarke = (text: string): string => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
};

export const PasswordModal: React.FC<PasswordModalProps> = ({ onClose, onSuccess, organizationId, onLogout, title = 'Coach-åtkomst', description = 'Ange gymmets lösenord för att låsa upp coach-verktygen på den här skärmen.' }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  // Koden verifieras på servern via verifyCoachUnlockCode. Klienten ser aldrig den
  // riktiga koden. Konfigurationsfel (ingen kod satt) och behörighetsfel får egna
  // texter — de ska inte se ut som att användaren skrivit fel.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChecking) return;

    if (!organizationId) {
      setError('Organisationen kunde inte avgöras. Ladda om sidan och försök igen.');
      return;
    }
    if (!password) return;

    setIsChecking(true);
    setError('');

    const verify = httpsCallable<{ organizationId: string; code: string }, { ok: boolean }>(
      functionsEurope, 'verifyCoachUnlockCode'
    );
    const markesNyckel = `smartstudio-coachkod-${organizationId}`;

    // Har den här skärmen fått ja av servern på just den här koden tidigare
    // släpper vi in direkt — och dubbelkollar i bakgrunden. Har koden bytts
    // rensas märket och nästa försök går den vanliga vägen.
    try {
      const sparatMarke = localStorage.getItem(markesNyckel);
      if (sparatMarke && sparatMarke === kodMarke(password)) {
        setIsChecking(false);
        onSuccess();
        verify({ organizationId, code: password })
          .then(res => { if (!res.data?.ok) localStorage.removeItem(markesNyckel); })
          .catch(() => { /* nätet svajar — märket får stå kvar */ });
        return;
      }
    } catch { /* lokal lagring blockerad — kör den vanliga vägen */ }

    try {
      const res = await verify({ organizationId, code: password });

      if (res.data?.ok) {
        try { localStorage.setItem(markesNyckel, kodMarke(password)); } catch { /* fullt förråd stoppar inget */ }
        onSuccess();
      } else {
        setError('Fel kod. Försök igen.');
        setFailedAttempts(prev => prev + 1);
        setPassword('');
      }
    } catch (err: any) {
      // Logga alltid råfelet. Utan det går det inte att skilja "ingen inloggad"
      // från "App Check släppte inte igenom" — båda kommer tillbaka som
      // unauthenticated och gav förut samma intetsägande text på skärmen.
      console.error('verifyCoachUnlockCode misslyckades:', err?.code, err?.message, err);
      const code = String(err?.code || '');
      if (code.includes('failed-precondition')) {
        setError('Ingen coachkod är satt för det här gymmet. Kontakta er administratör.');
      } else if (code.includes('resource-exhausted')) {
        setError(err?.message || 'För många försök. Vänta en stund och försök igen.');
      } else if (code.includes('permission-denied')) {
        setError('Du har inte behörighet till det här gymmet.');
      } else if (code.includes('unauthenticated')) {
        // Två helt olika fel kommer tillbaka som unauthenticated: ingen inloggad
        // användare, eller att App Check avvisade skärmen. Servern hinner inte
        // alltid säga vilket — när enforceAppCheck slår till avvisas anropet innan
        // vår kod körs och meddelandet blir intetsägande. Därför avgör vi här:
        // finns en inloggad användare kan det omöjligt vara inloggningen som saknas.
        const serverMsg = String(err?.message || '');
        const signedIn = !!auth?.currentUser;
        console.error('Coachkod nekad. Inloggad användare:', auth?.currentUser?.uid || 'ingen', '| serverns text:', serverMsg);
        if (!signedIn) {
          setError('Du måste vara inloggad för att låsa upp. Logga in igen och försök på nytt.');
        } else {
          // App Check spärrar inte längre det här anropet. Blir det ändå
          // unauthenticated med en inloggad användare är det inloggningen som
          // hunnit gå ut, inte en säkerhetskontroll — och då hjälper det att
          // logga in igen, inte att kontakta support.
          setError('Inloggningen verkar ha gått ut. Ladda om skärmen och försök igen.');
        }
      } else {
        setError(err?.message || 'Kunde inte verifiera koden. Försök igen.');
      }
    } finally {
      setIsChecking(false);
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
          
          <h2 id="password-modal-title" className="text-3xl font-black mb-2 uppercase tracking-tight">{title}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
            {description}
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

          {/* Lås upp får hela raden för sig själv. Tre knappar på en rad blev
              en hoptryckt gröt på skärmen i studion. */}
          <div className="mt-10 flex flex-col gap-3 w-full">
            <button 
              type="submit" 
              disabled={isChecking}
              className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform active:scale-95 text-lg uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isChecking ? 'Kontrollerar…' : 'Lås upp'}
            </button>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold py-4 rounded-2xl transition-colors uppercase tracking-widest text-xs"
              >
                Avbryt
              </button>
              {/* Alltid synlig. Förut krävdes ett misslyckat försök innan den
                  dök upp, och gick något annat fel kom den aldrig — då stod man
                  på skärmen utan väg ut. */}
              {onLogout && (
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