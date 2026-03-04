import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext'; // Importerar StudioContext för att slå upp org-namn
import { registerMemberWithCode } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CloseIcon } from './icons';
import { motion } from 'framer-motion';
import { UserTermsModal } from './UserTermsModal';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

interface LoginScreenProps {
    onClose?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose }) => {
    const { signIn, sendPasswordResetEmail } = useAuth();
    const { allOrganizations } = useStudio(); // Hämtar alla organisationer för att kunna matcha ID -> Kod
    const [view, setView] = useState<'login' | 'reset' | 'register'>('login');
    
    // UI States for Modals
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    
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

    // --- NY LOGIK: Hantera inbjudan från Pass-QR ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        
        // 1. Kolla om vi har en direkt invite-kod (den korta)
        const directCode = params.get('code'); 
        
        // 2. Kolla om vi har ett organizationId från pass-QR (invite-parametern)
        const orgIdFromPass = params.get('invite');

        if (directCode) {
            setInviteCode(directCode.toUpperCase());
            setView('register');
            window.history.replaceState({}, document.title, window.location.pathname);
        } 
        else if (orgIdFromPass && allOrganizations.length > 0) {
            // Om vi fick ett långt ID, försök hitta motsvarande korta inbjudningskod
            const matchedOrg = allOrganizations.find(o => o.id === orgIdFromPass);
            if (matchedOrg && matchedOrg.inviteCode) {
                setInviteCode(matchedOrg.inviteCode.toUpperCase());
                setView('register');
                // Vi behåller eventuella log-parametrar i URL:en för App.tsx, 
                // men rensar bara invite-id för att inte störa.
            }
        }
    }, [allOrganizations]); // Körs när organisationerna har laddats in

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
            if (onClose) onClose();
        } catch (err) {
            setError('Inloggningen misslyckades. Kontrollera e-post och lösenord.');
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
            setRegError(err.message || "Registrering misslyckades. Kontrollera koden.");
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
            
            {error && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm text-center mb-4">{error}</div>}

            <div className="space-y-6">
                <form onSubmit={handleLogin} className="space-y-6">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-postadress"
                        required
                        className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Lösenord"
                        required
                        className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                    <div className="text-right text-sm">
                        <button type="button" onClick={() => setView('reset')} className="text-primary/80 hover:text-primary">Glömt lösenord?</button>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-primary text-white font-bold py-4 rounded-lg disabled:bg-gray-600">
                        {loading ? 'Loggar in...' : 'Logga in'}
                    </button>
                </form>
                <div className="text-center text-sm text-gray-400">
                    Har du inget konto? <button type="button" onClick={() => setView('register')} className="text-primary hover:text-white">Skapa ett här</button>
                </div>
            </div>
        </>
    );

    const renderResetView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Återställ lösenord</h2>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-6">
                <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="E-postadress"
                    required
                    className="w-full bg-black text-white p-4 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary"
                />
                {resetSuccess && <p className="text-green-400 text-sm text-center">{resetSuccess}</p>}
                <button type="submit" disabled={resetLoading} className="w-full bg-primary text-white font-bold py-4 rounded-lg">Skicka länk</button>
                <button type="button" onClick={() => setView('login')} className="w-full text-primary/80">Tillbaka</button>
            </form>
        </>
    );

    const renderRegisterView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Skapa konto</h2>
                <p className="text-gray-400 mt-1">Fyll i dina uppgifter för att gå med.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                
                <div className="flex flex-col items-center mb-4">
                    <div 
                        className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {profileImage ? <img src={profileImage} alt="Profil" className="w-full h-full object-cover" /> : <CloseIcon className="w-8 h-8 text-gray-500 rotate-45" />}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-primary text-xs mt-2">Välj profilbild</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Förnamn" required className="bg-black text-white p-3 rounded-md border border-gray-700" />
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Efternamn" required className="bg-black text-white p-3 rounded-md border border-gray-700" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ålder" className="bg-black text-white p-3 rounded-md border border-gray-700" />
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="bg-black text-white p-3 rounded-md border border-gray-700">
                        <option value="prefer_not_to_say">Kön</option>
                        <option value="male">Man</option>
                        <option value="female">Kvinna</option>
                    </select>
                </div>

                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <label className="block text-xs font-bold text-primary uppercase mb-1">Inbjudningskod</label>
                    <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="KOD"
                        required
                        className="w-full bg-black text-white p-3 rounded-md border border-primary/30 text-center font-mono tracking-widest text-lg"
                        maxLength={6}
                    />
                </div>

                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="E-post" required className="w-full bg-black text-white p-3 rounded-md border border-gray-700" />
                
                <div className="grid grid-cols-2 gap-4">
                    <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Lösenord" required className="bg-black text-white p-3 rounded-md border border-gray-700" />
                    <input type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Bekräfta" required className="bg-black text-white p-3 rounded-md border border-gray-700" />
                </div>

                {regError && <p className="text-red-400 text-xs text-center">{regError}</p>}

                <div className="py-2 text-center">
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        Genom att skapa ett konto godkänner du våra <button type="button" onClick={() => setShowTerms(true)} className="text-primary hover:underline">Användarvillkor</button> och <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">Integritetspolicy</button>.
                    </p>
                </div>

                <button type="submit" disabled={regLoading} className="w-full bg-primary text-white font-black py-4 rounded-lg shadow-lg">
                    {regLoading ? 'Skapar konto...' : 'Gå med nu'}
                </button>

                <button type="button" onClick={() => setView('login')} className="w-full text-sm text-gray-400 text-center">Har du redan ett konto? Logga in</button>
            </form>
            <UserTermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
            <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
        </>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative">
                {onClose && (
                    <button onClick={onClose} className="absolute -top-12 right-0 text-white opacity-50 hover:opacity-100 transition-opacity">
                        <CloseIcon className="w-8 h-8" />
                    </button>
                )}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                    {view === 'login' && renderLoginView()}
                    {view === 'reset' && renderResetView()}
                    {view === 'register' && renderRegisterView()}
                </div>
            </motion.div>
        </div>
    );
};