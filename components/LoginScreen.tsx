
import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { registerMemberWithCode } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CloseIcon } from './icons';
import { motion } from 'framer-motion';

interface LoginScreenProps {
    onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose }) => {
    const { signIn, signInAsStudio, sendPasswordResetEmail } = useAuth();
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
                            autoComplete="username"
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
                            autoComplete="current-password"
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
                        autoComplete="username"
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
                            autoComplete="new-password"
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
                            autoComplete="new-password"
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
