import React, { useState } from 'react';
import { 
    signIn, // Din gamla funktion
    registerMemberWithCode, // Din gamla funktion
    auth, // Behövs för Google-lösningen nedan
    db    // Behövs för Google-lösningen nedan
} from '../services/firebaseService';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleIcon, EmailIcon, LockIcon, UserIcon, EyeIcon, EyeOffIcon } from './icons';

export const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // --- 1. VANLIG INLOGGNING (Använder din befintliga signIn) ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await signIn(email, password);
        } catch (err: any) {
            console.error(err);
            setError("Kunde inte logga in. Kontrollera uppgifterna.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. REGISTRERING (Använder din befintliga registerMemberWithCode) ---
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        
        if (!inviteCode) {
            setError("Du måste ha en inbjudningskod.");
            setIsLoading(false);
            return;
        }

        try {
            // Anpassar anropet till hur din service-fil ser ut
            await registerMemberWithCode(email, password, inviteCode, {
                firstName: firstName,
                lastName: lastName
            });
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Kunde inte registrera kontot. Kontrollera koden.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- 3. GOOGLE LOGIN (Löses lokalt här för att slippa ändra service-filen) ---
    const handleGoogleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            if (!auth) throw new Error("Firebase Auth ej initierad");
            
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            
            // Om db finns, kontrollera/skapa användare (samma logik som vi ville ha i servicen)
            if (db) {
                const userDocRef = doc(db, 'users', result.user.uid);
                const userSnapshot = await getDoc(userDocRef);
                
                if (!userSnapshot.exists()) {
                    await setDoc(userDocRef, {
                        email: result.user.email,
                        firstName: result.user.displayName?.split(' ')[0] || 'User',
                        lastName: result.user.displayName?.split(' ')[1] || '',
                        role: 'member', // Default
                        createdAt: Date.now(),
                        organizationId: '' // Sätts tomt tills vidare
                    });
                }
            }
        } catch (err: any) {
            console.error(err);
            setError("Google-inloggning misslyckades.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black px-4 transition-colors duration-500">
            <div className="max-w-md w-full space-y-8 animate-fade-in">
                
                {/* LOGO & RUBRIK */}
                <div className="text-center">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500 mb-2 tracking-tighter">
                        SmartStudio
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {isRegistering ? 'Skapa ditt konto' : 'Logga in för att fortsätta'}
                    </p>
                </div>

                {/* FORMULÄR-CONTAINER */}
                <div className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
                    
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-300 text-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
                        
                        {isRegistering && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="relative">
                                    <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Förnamn"
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Efternamn"
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <EmailIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="E-postadress"
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>

                        <div className="relative">
                            <LockIcon className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Lösenord"
                                className="w-full pl-11 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                        </div>

                        {isRegistering && (
                            <div className="relative animate-fade-in-up">
                                <div className="absolute left-4 top-3.5 h-5 w-5 flex items-center justify-center text-gray-400 font-bold text-xs border border-gray-400 rounded">#</div>
                                <input
                                    type="text"
                                    required={isRegistering}
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    placeholder="Inbjudningskod (Krävs)"
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all dark:text-white placeholder-gray-400"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Arbetar...' : (isRegistering ? 'Skapa konto' : 'Logga in')}
                        </button>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">Eller fortsätt med</span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <GoogleIcon className="w-5 h-5" />
                                <span>Google</span>
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-gray-600 dark:text-gray-400">
                    {isRegistering ? 'Har du redan ett konto?' : 'Har du inget konto än?'}
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                        }}
                        className="ml-2 font-bold text-purple-600 dark:text-purple-400 hover:underline"
                    >
                        {isRegistering ? 'Logga in' : 'Registrera dig'}
                    </button>
                </p>
                
            </div>
        </div>
    );
};