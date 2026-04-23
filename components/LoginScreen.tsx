import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { registerMemberWithCode, getOrganizationLocationsByCode } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CloseIcon, EyeIcon, EyeOffIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { UserTermsModal } from './UserTermsModal';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { OrgLocation } from '../types';

interface LoginScreenProps {
    onClose?: () => void;
    onRegisterGym?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose, onRegisterGym }) => {
    const { signIn, signInAsStudio, sendPasswordResetEmail } = useAuth();
    const [view, setView] = useState<'login' | 'reset' | 'register'>('login');
    
    // UI States for Modals
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    
    // Login state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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
    const [registerType, setRegisterType] = useState<'member' | 'coach'>('member');
    
    // Profile Fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState('prefer_not_to_say');
    const [profileImage, setProfileImage] = useState<string | null>(null); 
    const [availableLocations, setAvailableLocations] = useState<OrgLocation[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>('');

    const [regError, setRegError] = useState<string | null>(null);
    const [regLoading, setRegLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Kolla URL-parametrar vid start
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const invite = params.get('invite') || params.get('coach');
        if (invite) {
            setInviteCode(invite.toUpperCase());
            setView('register');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        if (inviteCode.length === 6 && registerType === 'member') {
            getOrganizationLocationsByCode(inviteCode).then(locs => {
                setAvailableLocations(locs);
                if (locs.length === 1) {
                    setSelectedLocationId(locs[0].id);
                } else if (locs.length > 0 && !selectedLocationId) {
                    // Optional fallback, don't strictly auto-select if there are multiple.
                    // Actually, let's select the first one so it's not null, but they have to change it if they want.
                    setSelectedLocationId(locs[0].id);
                }
            });
        } else {
            setAvailableLocations([]);
            setSelectedLocationId('');
        }
    }, [inviteCode, registerType]);

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
                    birthDate: birthDate || undefined,
                    gender: gender as any,
                    photoBase64: profileImage,
                    locationId: selectedLocationId || undefined
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
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Logga in</h2>
                <p className="text-gray-400 mt-1 text-sm font-medium">För administratörer och medlemmar</p>
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
                            className="w-full bg-black text-white p-4 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div className="relative">
                        <label htmlFor="password-input" className="sr-only">Lösenord</label>
                        <input
                            id="password-input"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Lösenord"
                            required
                            autoComplete="current-password"
                            className="w-full bg-black text-white p-4 pr-12 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                    </div>
                    
                    <div className="text-right text-sm">
                        <button type="button" onClick={() => setView('reset')} className="font-medium text-gray-500 hover:text-primary transition-colors">
                            Glömt lösenord?
                        </button>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-xl transition-all disabled:bg-gray-600 shadow-lg shadow-primary/20 uppercase tracking-widest"
                        >
                            {loading ? 'Loggar in...' : 'Logga in'}
                        </button>
                    </div>
                </form>
                
                <div className="text-center text-sm flex flex-col gap-2 mt-4">
                    <div>
                        <span className="text-gray-500">Har du inget konto? </span>
                        <button type="button" onClick={() => setView('register')} className="font-bold text-primary hover:text-white transition-colors underline decoration-dotted underline-offset-4">
                            Använd inbjudningskod
                        </button>
                    </div>

                    {/* HÄR ÄR DEN TYDLIGA PILLER-KNAPPEN FÖR ATT REGISTRERA GYM */}
                    {onRegisterGym && (
                        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col items-center">
                            <p className="text-gray-500 text-xs mb-4 font-bold uppercase tracking-widest">Driver du ett gym?</p>
                            <button 
                                type="button" 
                                onClick={onRegisterGym} 
                                className="bg-transparent hover:bg-white hover:text-black text-primary font-black py-3 px-10 rounded-full border-2 border-primary transition-all transform active:scale-95 uppercase tracking-widest text-xs shadow-lg shadow-primary/10"
                            >
                                Registrera ditt gym
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    const renderResetView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Återställ lösenord</h2>
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
                        className="w-full bg-black text-white p-4 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                </div>
                
                {resetSuccess && <p className="text-green-400 text-sm text-center">{resetSuccess}</p>}
                {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}

                <div>
                    <button
                        type="submit"
                        disabled={resetLoading}
                        className="w-full bg-primary hover:brightness-95 text-white font-bold py-4 rounded-xl transition-colors disabled:bg-gray-600 uppercase tracking-widest"
                    >
                        {resetLoading ? 'Skickar...' : 'Skicka länk'}
                    </button>
                </div>

                <div className="text-center text-sm">
                    <button type="button" onClick={() => setView('login')} className="font-medium text-gray-500 hover:text-primary transition-colors">
                        &larr; Tillbaka till inloggning
                    </button>
                </div>
            </form>
        </>
    );

    const renderRegisterView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Skapa konto</h2>
                <p className="text-gray-400 mt-1">Gå med i ett befintligt gym</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                
                <div className="flex bg-gray-800 p-1 rounded-xl mb-6">
                    <button
                        type="button"
                        onClick={() => setRegisterType('member')}
                        className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${
                            registerType === 'member' 
                                ? 'bg-primary text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        MEDLEM
                    </button>
                    <button
                        type="button"
                        onClick={() => setRegisterType('coach')}
                        className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${
                            registerType === 'coach' 
                                ? 'bg-primary text-white shadow-md' 
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        COACH
                    </button>
                </div>

                {registerType === 'member' && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6 text-left">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-purple-500/20 text-purple-300 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">BETA</span>
                            <h3 className="text-sm font-bold text-purple-100">Early Access</h3>
                        </div>
                        <p className="text-xs text-purple-200/70 leading-relaxed">
                            Bli en av de första att testa vår nya medlemsapp! Logga pass, följ din utveckling och sätt personliga mål.
                        </p>
                    </div>
                )}

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
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Förnamn</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Anna"
                            required
                            className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Efternamn</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Andersson"
                            required
                            className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Födelsedatum</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition [color-scheme:dark]"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Kön</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition appearance-none"
                        >
                            <option value="prefer_not_to_say">Vill ej ange</option>
                            <option value="male">Man</option>
                            <option value="female">Kvinna</option>
                            <option value="other">Annat</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label htmlFor="invite-code" className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">
                        {registerType === 'member' ? 'Inbjudningskod' : 'Coachkod'}
                    </label>
                    <input
                        id="invite-code"
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="KOD (6 tecken)"
                        required
                        className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition text-center font-black tracking-widest text-lg uppercase"
                        maxLength={6}
                    />
                </div>

                {availableLocations.length > 1 && registerType === 'member' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="relative z-50">
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Välj Anläggning / Ort</label>
                        <button
                            type="button"
                            onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                            className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition flex items-center justify-between"
                        >
                            <span className="font-medium">
                                {availableLocations.find(l => l.id === selectedLocationId)?.name || 'Välj...'}
                            </span>
                            <svg className={`w-5 h-5 transition-transform duration-200 text-gray-400 ${isLocationDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>

                        <AnimatePresence>
                            {isLocationDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl z-[100]"
                                >
                                    {availableLocations.map(loc => (
                                        <button
                                            key={loc.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedLocationId(loc.id);
                                                setIsLocationDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-5 py-4 transition-colors border-b last:border-b-0 border-gray-800 ${selectedLocationId === loc.id ? 'bg-primary/20 text-primary font-bold' : 'text-gray-300 hover:bg-gray-800'}`}
                                        >
                                            {loc.name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                <div>
                    <label htmlFor="reg-email" className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">E-post</label>
                    <input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="din@email.com"
                        required
                        autoComplete="username"
                        className="w-full bg-black text-white p-3 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <label htmlFor="reg-password" className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Lösenord</label>
                        <input
                            id="reg-password"
                            type={showPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Minst 6 tecken"
                            required
                            autoComplete="new-password"
                            className="w-full bg-black text-white p-3 pr-10 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-[32px] text-gray-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="relative">
                        <label htmlFor="reg-confirm-password" className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Bekräfta</label>
                        <input
                            id="reg-confirm-password"
                            type={showPassword ? "text" : "password"}
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="Upprepa"
                            required
                            autoComplete="new-password"
                            className="w-full bg-black text-white p-3 pr-10 rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                {regError && <p className="text-red-400 text-sm text-center font-bold">{regError}</p>}

                <div className="py-2 text-center">
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        Genom att skapa ett konto godkänner du våra{' '}
                        <button type="button" onClick={() => setShowTerms(true)} className="text-primary font-bold hover:underline">Användarvillkor</button>
                        {' '}och bekräftar att du läst vara{' '}
                        <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary font-bold hover:underline">Integritetspolicy</button>.
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={regLoading}
                        className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-xl transition-all disabled:bg-gray-600 shadow-lg shadow-primary/20 uppercase tracking-widest"
                    >
                        {regLoading ? 'Skapar konto...' : 'Gå med och logga in'}
                    </button>
                </div>

                <div className="text-center text-sm pb-2">
                    <button type="button" onClick={() => setView('login')} className="font-bold text-gray-500 hover:text-primary transition-colors">
                        &larr; Tillbaka till inloggning
                    </button>
                </div>
            </form>
            
            <UserTermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
            <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
        </>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4 font-sans">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative"
            >
                {onClose && (
                    <button onClick={onClose} className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2">
                        <CloseIcon className="w-8 h-8" />
                    </button>
                )}
                <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-8 sm:p-10 max-h-[95vh] flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                    {view === 'login' && renderLoginView()}
                    {view === 'reset' && renderResetView()}
                    {view === 'register' && renderRegisterView()}
                </div>
            </motion.div>
        </div>
    );
};