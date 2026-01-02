import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { registerMemberWithCode } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CloseIcon } from './icons';
import { motion } from 'framer-motion';

// Google Icon SVG
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5 mr-2">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

interface LoginScreenProps {
    onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose }) => {
    const { signIn, signInWithGoogle, signInAsStudio, sendPasswordResetEmail } = useAuth();
    const [view, setView] = useState<'login' | 'reset' | 'register'>('login');
    
    // Login state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Reset state
    const [resetEmail, setResetEmail] = useState('');
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState<string | null>(null);

    // Register state
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    
    // Profile Fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('prefer_not_to_say');
    const [profileImage, setProfileImage] = useState<string | null>(null); 

    const [regError, setRegError] = useState<string | null>(null);
    const [regLoading, setRegLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
            if (onClose) onClose();
        } catch (err) {
            setError('Inloggningen misslyckades. Kontrollera e-post och lösenord.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await signInWithGoogle();
            if (onClose) onClose();
        } catch (err) {
            setError('Inloggningen med Google misslyckades.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleStudioLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await signInAsStudio();
            if (onClose) onClose();
        } catch (err) {
            setError("Kunde inte starta studioläge.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetError(null);
        setResetSuccess(null);
        setResetLoading(true);
        try {
            await sendPasswordResetEmail(resetEmail);
            setResetSuccess(`En återställningslänk har skickats till ${resetEmail} om kontot finns.`);
        } catch (err) {
            setResetSuccess(`En återställningslänk har skickats till ${resetEmail} om kontot finns.`);
        } finally {
            setResetLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await resizeImage(file, 400, 400, 0.8);
                setProfileImage(base64);
            } catch (err) {
                console.error("Failed to process image", err);
                setRegError("Kunde inte läsa bilden.");
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegError(null);
        
        if (regPassword !== regConfirmPassword) {
            setRegError("Lösenorden matchar inte.");
            return;
        }
        if (regPassword.length < 6) {
            setRegError("Lösenordet måste vara minst 6 tecken.");
            return;
        }
        if (!inviteCode.trim()) {
            setRegError("Inbjudningskod saknas.");
            return;
        }
        if (!firstName.trim() || !lastName.trim()) {
            setRegError("Namn är obligatoriskt.");
            return;
        }

        setRegLoading(true);
        try {
            await registerMemberWithCode(
                regEmail, 
                regPassword, 
                inviteCode.trim(),
                {
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    age: age ? parseInt(age) : undefined,
                    gender: gender as any,
                    photoBase64: profileImage
                }
            );
            // AuthContext handles state update automatically
            if (onClose) onClose();
        } catch (err: any) {
            setRegError(err.message || "Registrering misslyckades. Kontrollera koden och försök igen.");
        } finally {
            setRegLoading(false);
        }
    };

    const renderLoginView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Logga in</h2>
                <p className="text-gray-400 mt-1">För administratörer och medlemmar</p>
            </div>
            
            {error && (
                <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm text-center mb-4">
                    {error}
                </div>
            )}

            <div className="space-y-6">
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full bg-white text-gray-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-500"
                >
                    <GoogleIcon />
                    <span>Logga in med Google</span>
                </button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-900 text-gray-400">Eller med e-post</span>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="sr-only">E-post</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="E-postadress"
                            required
                            className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="password-input" className="sr-only">Lösenord</label>
                        <input
                            id="password-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Lösenord"
                            required
                            className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    
                    <div className="text-right text-sm">
                        <button type="button" onClick={() => setView('reset')} className="font-medium text-primary/80 hover:text-primary transition-colors">
                            Glömt lösenord?
                        </button>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 rounded-lg transition-colors disabled:bg-gray-600"
                        >
                            {loading ? 'Loggar in...' : 'Logga in'}
                        </button>
                    </div>
                </form>
                
                <div className="text-center text-sm">
                    <span className="text-gray-400">Har du inget konto? </span>
                    <button type="button" onClick={() => setView('register')} className="font-medium text-primary hover:text-white transition-colors">
                        Skapa ett med inbjudningskod
                    </button>
                </div>
            </div>
        </>
    );

    const renderResetView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Återställ lösenord</h2>
                <p className="text-gray-400 mt-1">Ange din e-post så skickar vi en länk.</p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                    <label htmlFor="reset-email" className="sr-only">E-post</label>
                    <input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="E-postadress"
                        required
                        autoFocus
                        className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                </div>
                
                {resetSuccess && <p className="text-green-400 text-sm text-center">{resetSuccess}</p>}
                {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}

                <div>
                    <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 rounded-lg transition-colors disabled:bg-gray-600"
                    >
                        {resetLoading ? 'Skickar...' : 'Skicka återställningslänk'}
                    </button>
                </div>

                <div className="text-center text-sm">
                    <button type="button" onClick={() => setView('login')} className="font-medium text-primary/80 hover:text-primary transition-colors">
                        &larr; Tillbaka till inloggning
                    </button>
                </div>
            </form>
        </>
    );

    const renderRegisterView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Skapa konto</h2>
                <p className="text-gray-400 mt-1">Fyll i dina uppgifter och inbjudningskod.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* Profile Picture */}
                <div className="flex flex-col items-center mb-4">
                    <div 
                        className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative group"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {profileImage ? (
                            <img src={profileImage} alt="Profil" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-xs text-white font-bold">Ändra</span>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary text-sm mt-2 font-medium hover:underline">Välj profilbild</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Förnamn</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Anna"
                            required
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Efternamn</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Andersson"
                            required
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ålder</label>
                        <input
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="30"
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kön</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition appearance-none"
                        >
                            <option value="prefer_not_to_say">Vill ej ange</option>
                            <option value="male">Man</option>
                            <option value="female">Kvinna</option>
                            <option value="other">Annat</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="invite-code" className="block text-xs font-bold text-gray-500 uppercase mb-1">Inbjudningskod</label>
                    <input
                        id="invite-code"
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="KOD (6 tecken)"
                        required
                        className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition text-center font-mono tracking-widest text-lg uppercase"
                        maxLength={6}
                    />
                </div>
                <div>
                    <label htmlFor="reg-email" className="block text-xs font-bold text-gray-500 uppercase mb-1">E-post</label>
                    <input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="din@email.com"
                        required
                        className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="reg-password" className="block text-xs font-bold text-gray-500 uppercase mb-1">Lösenord</label>
                        <input
                            id="reg-password"
                            type="password"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Minst 6 tecken"
                            required
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-gray-500 uppercase mb-1">Bekräfta</label>
                        <input
                            id="reg-confirm-password"
                            type="password"
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="Upprepa"
                            required
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                {regError && <p className="text-red-400 text-sm text-center">{regError}</p>}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={regLoading}
                        className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 rounded-lg transition-colors disabled:bg-gray-600"
                    >
                        {regLoading ? 'Skapar konto...' : 'Gå med och logga in'}
                    </button>
                </div>

                <div className="text-center text-sm pb-2">
                    <button type="button" onClick={() => setView('login')} className="font-medium text-primary/80 hover:text-primary transition-colors">
                        &larr; Har du redan ett konto? Logga in
                    </button>
                </div>
            </form>
        </>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative"
            >
                {onClose && (
                    <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-gray-300">
                        <CloseIcon className="w-8 h-8" />
                    </button>
                )}
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-h-[90vh] flex flex-col shadow-2xl">
                    {view === 'login' && renderLoginView()}
                    {view === 'reset' && renderResetView()}
                    {view === 'register' && renderRegisterView()}
                </div>
            </motion.div>
        </div>
    );
};