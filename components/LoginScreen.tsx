import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { registerMemberWithCode, getInviteCodeInfo, InviteCodeDetails } from '../services/firebaseService';
import { resizeImage } from '../utils/imageUtils';
import { CloseIcon, EyeIcon, EyeOffIcon } from './icons';
import { motion } from 'framer-motion';
import { UserTermsModal } from './UserTermsModal';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';

interface LoginScreenProps {
    onClose?: () => void;
    onRegisterGym?: () => void;
}

const BrandMark: React.FC = () => (
    <div className="flex items-center justify-center mb-5">
        <img
            src="/favicon.png"
            alt="SmartStudio"
            className="w-16 h-16 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700"
            referrerPolicy="no-referrer"
        />
    </div>
);

export const LoginScreen: React.FC<LoginScreenProps> = ({ onClose, onRegisterGym }) => {
    const { signIn, signInAsStudio, sendPasswordResetEmail } = useAuth();
    const [view, setView] = useState<'login' | 'reset' | 'register'>('login');
    
    // UI States for Modals
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    
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
    const [inviteDetails, setInviteDetails] = useState<InviteCodeDetails | null>(null);
    const [isCheckingCode, setIsCheckingCode] = useState(false);
    const [existingAccountError, setExistingAccountError] = useState(false);
    
    // Profile Fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState('prefer_not_to_say');
    const [profileImage, setProfileImage] = useState<string | null>(null); 

    const [regError, setRegError] = useState<string | null>(null);
    const [regLoading, setRegLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [invitedLocationId, setInvitedLocationId] = useState<string | null>(null);

    // Kolla URL-parametrar vid start
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const invite = params.get('invite') || params.get('coach');
        const locationParam = params.get('location');
        if (invite) {
            const upper = invite.toUpperCase().trim();
            setInviteCode(upper);
            setView('register');
            if (locationParam) {
                setInvitedLocationId(locationParam);
            }

            setIsCheckingCode(true);
            getInviteCodeInfo(upper)
                .then(info => {
                    setInviteDetails(info);
                    if (info.isValid) {
                        if (info.locationId) {
                            setInvitedLocationId(info.locationId);
                        } else if (info.locations && info.locations.length === 1) {
                            setInvitedLocationId(info.locations[0].id);
                        }
                    }
                })
                .catch(() => {
                    setInviteDetails({ isValid: false, code: upper, error: "Länken är ogiltig — be gymmet om en ny" });
                })
                .finally(() => {
                    setIsCheckingCode(false);
                });

            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const handleLogin = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
            if (onClose) onClose();
        } catch (err: any) {
            // Förut sa rutan samma mening oavsett vad som gick fel. På skärmen i
            // studion, dit man inte kan koppla en konsol, blev varje misslyckad
            // inloggning därmed en gissningslek. Nu säger den vad som hände.
            const kod = String(err?.code || '');
            console.error('Inloggning misslyckades:', kod, err?.message, err);

            // Firebase har bytt kod för det här felet över tid, och skickar numera
            // invalid-login-credentials. Den fastnade inte i mitt första filter och
            // hamnade i den intetsägande grenen längst ner.
            if (kod.includes('wrong-password') || kod.includes('user-not-found')
                || kod.includes('invalid-credential') || kod.includes('invalid-login-credentials')
                || kod.includes('invalid-email')) {
                setError('Fel e-post eller lösenord.');
            } else if (kod.includes('unauthorized-domain')) {
                setError(`Adressen ${window.location.hostname} är inte godkänd för inloggning. Kontakta support.`);
            } else if (kod.includes('too-many-requests')) {
                setError('För många försök. Vänta en stund och prova igen.');
            } else if (kod.includes('network-request-failed')) {
                // Skärmen i studion får det här felet trots att internet fungerar.
                // Då är frågan VAR det tar stopp. Vi provar själva att nå Googles
                // inloggningsserver och skriver ut resultatet — så blir enheten
                // sin egen felsökare, utan att någon behöver koppla in en konsol.
                setError('Ingen kontakt med inloggningsservern. Undersöker varför…');
                try {
                    const start = Date.now();
                    const svar = await fetch(
                        'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=diagnos',
                        { method: 'POST', body: '{}' }
                    );
                    const enkelVag = (window as any).__enkelInloggningsvag ? 'på' : 'AV';
                    const logg = ((window as any).__inloggningslogg || []).join(' | ') || 'tom';
                    // Loggen visade att inloggningsbiblioteket dör INNAN det når
                    // nätet. Då saknar webbläsaren någon modern funktion som
                    // biblioteket tar för given. Vi kollar de troliga och skriver
                    // ut vilka som fattas — det pekar ut exakt vad som ska lagas.
                    const w = window as any;
                    const saknas = [
                        ['fetch', typeof w.fetch === 'function'],
                        ['Headers', typeof w.Headers === 'function'],
                        ['AbortController', typeof w.AbortController === 'function'],
                        ['structuredClone', typeof w.structuredClone === 'function'],
                        ['randomUUID', !!(w.crypto && typeof w.crypto.randomUUID === 'function')],
                        ['fromEntries', typeof Object.fromEntries === 'function'],
                        ['allSettled', typeof (Promise as any).allSettled === 'function'],
                        ['replaceAll', typeof (String.prototype as any).replaceAll === 'function'],
                        ['at', typeof (Array.prototype as any).at === 'function'],
                        ['queueMicrotask', typeof w.queueMicrotask === 'function'],
                        ['BroadcastChannel', typeof w.BroadcastChannel === 'function'],
                        ['TextEncoder', typeof w.TextEncoder === 'function'],
                        ['indexedDB', !!w.indexedDB],
                        ['globalThis', typeof globalThis !== 'undefined'],
                    ].filter(([, finns]) => !finns).map(([namn]) => namn).join(',') || 'inget';
                    setError(`Googles server svarar (${svar.status} på ${Date.now() - start} ms), men själva inloggningsanropet kom inte fram. [enkel väg: ${enkelVag}] Anropslogg: ${logg}. Saknas: ${saknas}. Visa den här texten för support.`);
                } catch {
                    setError('Enheten blockerar anrop till Googles inloggningsserver (googleapis.com). Kontrollera om webbläsaren har en annonsblockerare eller om nätverket i lokalen filtrerar trafik.');
                }
            } else if (kod.includes('user-disabled')) {
                setError('Kontot är avstängt. Kontakta support.');
            } else if (kod.includes('web-storage-unsupported') || kod.includes('operation-not-supported')) {
                setError('Webbläsaren tillåter inte att inloggningen sparas. Slå på cookies och webbplatsdata för den här adressen.');
            } else {
                setError(`Inloggningen misslyckades${kod ? ` (${kod})` : ''}. Visa den här texten för support.`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e && e.preventDefault) e.preventDefault();
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

    const handleRegister = async (e?: React.FormEvent | React.KeyboardEvent) => {
        if (e && e.preventDefault) e.preventDefault();
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

        const effectiveLocationId = invitedLocationId || inviteDetails?.locationId || undefined;
        if (inviteDetails?.isValid && !inviteDetails.locationId && inviteDetails.locations && inviteDetails.locations.length > 1 && !effectiveLocationId) {
            setRegError("Vänligen välj din ort.");
            return;
        }

        setRegLoading(true);
        setExistingAccountError(false);
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
                    locationId: effectiveLocationId
                }
            );
            if (onClose) onClose();
        } catch (err: any) {
            const errStr = (err.code || err.message || '').toString().toLowerCase();
            if (errStr.includes('email-already-in-use') || errStr.includes('används redan')) {
                setExistingAccountError(true);
                setRegError(null);
            } else {
                setRegError(err.message || "Registrering misslyckades. Kontrollera koden och försök igen.");
            }
        } finally {
            setRegLoading(false);
        }
    };

    const renderLoginView = () => (
        <>
            <div className="text-center mb-6 shrink-0">
                <BrandMark />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Logga in</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">För administratörer och medlemmar</p>
            </div>
            
            <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1 pb-1 custom-scrollbar">
                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm text-center mb-4">
                        {error}
                    </div>
                )}

                <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e); }}>
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-4 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-4 pr-12 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-white transition-colors"
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
                            type="button"
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-xl transition-all disabled:bg-gray-600 shadow-lg shadow-primary/20 uppercase tracking-widest"
                        >
                            {loading ? 'Loggar in...' : 'Logga in'}
                        </button>
                    </div>
                </div>
                
                <div className="text-center text-sm flex flex-col gap-2 mt-4">
                    <div>
                        <span className="text-gray-500">Har du inget konto? </span>
                        <button type="button" onClick={() => setView('register')} className="font-bold text-primary hover:text-white transition-colors underline decoration-dotted underline-offset-4">
                            Använd inbjudningskod
                        </button>
                    </div>

                    {/* HÄR ÄR DEN TYDLIGA PILLER-KNAPPEN FÖR ATT REGISTRERA GYM */}
                    {onRegisterGym && (
                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col items-center">
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
            <div className="text-center mb-6 shrink-0">
                <BrandMark />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Återställ lösenord</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Ange din e-post så skickar vi en länk.</p>
            </div>
            <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-1 pb-1 custom-scrollbar" onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword(e); }}>
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
                        className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-4 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                    />
                </div>
                
                {resetSuccess && <p className="text-green-400 text-sm text-center">{resetSuccess}</p>}
                {resetError && <p className="text-red-400 text-sm text-center">{resetError}</p>}

                <div>
                    <button
                        type="button"
                        onClick={handleResetPassword}
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
            </div>
        </>
    );

    const renderRegisterView = () => (
        <>
            <div className="text-center mb-6 shrink-0">
                <BrandMark />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Skapa konto</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Gå med i ett befintligt gym</p>
            </div>
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 pb-1 custom-scrollbar" onKeyDown={(e) => { if (e.key === 'Enter') handleRegister(e); }}>
                
                {/* Invite Confirmation Banner or Error */}
                {isCheckingCode ? (
                    <div className="bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-center gap-3 animate-pulse">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Kontrollerar inbjudningskod...</span>
                    </div>
                ) : inviteDetails?.isValid ? (
                    <div className="space-y-3">
                        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-4 animate-fade-in">
                            {inviteDetails.logoUrl ? (
                                <img src={inviteDetails.logoUrl} alt={inviteDetails.organizationName} className="w-12 h-12 object-contain rounded-xl bg-black/40 p-1 flex-shrink-0" />
                            ) : (
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black text-xl flex-shrink-0">
                                    🏋️
                                </div>
                            )}
                            <div className="min-w-0">
                                <span className="text-[10px] font-black tracking-widest uppercase text-primary block">Inbjudan bekräftad</span>
                                <h3 className="text-sm sm:text-base font-black text-gray-900 dark:text-white tracking-tight truncate">
                                    Du går med i {inviteDetails.organizationName}
                                    {inviteDetails.locationName ? ` — ${inviteDetails.locationName}` : ''}
                                </h3>
                            </div>
                        </div>

                        {/* Ort-väljare om org-övergripande kod har flera orter */}
                        {!inviteDetails.locationId && inviteDetails.locations && inviteDetails.locations.length > 1 && (
                            <div className="bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-2xl p-4 space-y-1.5 animate-fade-in">
                                <label htmlFor="select-location" className="block text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                                    Välj din ort <span className="text-primary">*</span>
                                </label>
                                <select
                                    id="select-location"
                                    value={invitedLocationId || ''}
                                    onChange={(e) => setInvitedLocationId(e.target.value)}
                                    required
                                    className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition text-sm font-bold"
                                >
                                    <option value="" disabled>-- Välj din ort --</option>
                                    {inviteDetails.locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                ) : inviteDetails?.isValid === false ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                        <span className="text-xl">⚠️</span>
                        <p className="text-xs font-bold text-red-400">
                            Länken är ogiltig — be gymmet om en ny
                        </p>
                    </div>
                ) : null}

                <div className="flex flex-col items-center mb-4">
                    <div 
                        className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors relative group"
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
                            <span className="text-xs text-gray-900 dark:text-white font-bold">Ändra</span>
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Födelsedatum</label>
                        <input
                            type="tel"
                            placeholder="ÅÅÅÅ-MM-DD"
                            maxLength={10}
                            value={birthDate}
                            onChange={(e) => {
                                let v = e.target.value.replace(/\D/g, '');
                                if (v.length > 8) v = v.slice(0, 8);
                                if (v.length > 6) {
                                    v = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
                                } else if (v.length > 4) {
                                    v = `${v.slice(0, 4)}-${v.slice(4)}`;
                                }
                                setBirthDate(v);
                            }}
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition font-bold tracking-widest"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">Kön</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: 'female', label: 'Kvinna' },
                                { value: 'male', label: 'Man' },
                                { value: 'other', label: 'Annat' },
                                { value: 'prefer_not_to_say', label: 'Vill ej ange' }
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setGender(opt.value)}
                                    className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${gender === opt.value ? 'bg-primary border-primary text-black transform scale-[0.98]' : 'bg-black border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-500'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Show manual code field ONLY if no valid invite details exist */}
                {!inviteDetails?.isValid && (
                    <div>
                        <label htmlFor="invite-code" className="block text-[10px] font-black text-gray-500 uppercase mb-1 tracking-widest">
                            Ange kod (Inbjudnings- eller coachkod)
                        </label>
                        <input
                            id="invite-code"
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="KOD (6 tecken)"
                            required
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition text-center font-black tracking-widest text-lg uppercase"
                            maxLength={6}
                        />
                    </div>
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
                        className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 pr-10 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-[32px] text-gray-500 dark:text-gray-400 hover:text-white transition-colors"
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
                            className="w-full bg-white dark:bg-black text-gray-900 dark:text-white p-3 pr-10 rounded-xl border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition"
                        />
                    </div>
                </div>

                {existingAccountError ? (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2 animate-fade-in">
                        <p className="text-amber-400 font-bold text-sm">Du har redan ett konto — logga in</p>
                        <button
                            type="button"
                            onClick={() => {
                                setEmail(regEmail);
                                setView('login');
                                setExistingAccountError(false);
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-4 py-2 rounded-xl uppercase tracking-wider transition-all shadow-md"
                        >
                            Gå till inloggning
                        </button>
                    </div>
                ) : (
                    regError && <p className="text-red-400 text-sm text-center font-bold">{regError}</p>
                )}

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
                        type="button"
                        onClick={handleRegister}
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
            </div>
            
            <UserTermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
            <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
        </>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black text-gray-900 dark:text-white p-4 font-sans">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative"
            >
                {onClose && (
                    <button onClick={onClose} className="absolute -top-12 right-0 text-gray-900 dark:text-white hover:text-gray-300 p-2">
                        <CloseIcon className="w-8 h-8" />
                    </button>
                )}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[2.5rem] p-6 sm:p-10 max-h-[90vh] sm:max-h-[95vh] w-full max-w-md flex flex-col shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                    {view === 'login' && renderLoginView()}
                    {view === 'reset' && renderResetView()}
                    {view === 'register' && renderRegisterView()}
                </div>
            </motion.div>
        </div>
    );
};