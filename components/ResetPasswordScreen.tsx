import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset } from '../services/firebaseService';
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ResetPasswordScreen: React.FC = () => {
    const [email, setEmail] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // Status states
    const [verifying, setVerifying] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    
    // Parse oobCode from URL
    const [oobCode, setOobCode] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('oobCode');
        setOobCode(code);

        if (!code) {
            setVerificationError('Länken för återställning av lösenord verkar vara ogiltig eller sakna säkerhetskod.');
            setVerifying(false);
            return;
        }

        // Verify that the code is valid and find the associated email
        const verifyCode = async () => {
            try {
                const userEmail = await verifyPasswordResetCode(code);
                setEmail(userEmail);
            } catch (err: any) {
                console.error("Verification of oobCode failed:", err);
                if (err.code === 'auth/expired-action-code') {
                    setVerificationError('Denna återställningslänk har tyvärr gått ut. Vänligen begär en ny.');
                } else if (err.code === 'auth/invalid-action-code') {
                    setVerificationError('Denna återställningskod är ogiltig eller har redan använts.');
                } else if (err.code === 'auth/user-disabled') {
                    setVerificationError('Detta konto har inaktiverats.');
                } else {
                    setVerificationError('Kunde inte verifiera återställningskoden. Kontrollera att länken är korrekt.');
                }
            } finally {
                setVerifying(false);
            }
        };

        verifyCode();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        if (!oobCode) {
            setSubmitError('Säkerhetskod saknas. Vänligen starta om processen.');
            return;
        }

        if (password.length < 6) {
            setSubmitError('Lösenordet måste vara minst 6 tecken långt.');
            return;
        }

        if (password !== confirmPassword) {
            setSubmitError('Lösenorden matchar inte varandra.');
            return;
        }

        setSubmitting(true);
        try {
            await confirmPasswordReset(oobCode, password);
            setSuccess(true);
        } catch (err: any) {
            console.error("Failed to reset password:", err);
            if (err.code === 'auth/weak-password') {
                setSubmitError('Det valda lösenordet är för svagt. Välj ett starkare lösenord.');
            } else if (err.code === 'auth/expired-action-code') {
                setSubmitError('Koden har gått ut. Vänligen gå tillbaka och begär en ny länk.');
            } else {
                setSubmitError(err.message || 'Ett fel uppstod vid uppdatering av lösenordet. Försök igen.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoToLogin = () => {
        const hostname = window.location.hostname;
        const targetAppUrl = hostname.includes('staging.smartstudio.se')
            ? 'https://app.staging.smartstudio.se'
            : 'https://app.smartstudio.se';
        window.location.href = targetAppUrl;
    };

    return (
        <div id="reset-password-page-container" className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            {/* Header / Logo */}
            <div className="flex items-center gap-3 mb-8">
                <img src="/favicon.png" alt="SmartStudio Logo" className="w-12 h-12 rounded-xl shadow-lg border border-slate-800" />
                <span className="text-xl font-black text-white uppercase tracking-tight">SmartStudio</span>
            </div>

            <motion.div 
                id="reset-password-card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
            >
                {/* Background ambient glow glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <AnimatePresence mode="wait">
                    {verifying ? (
                        <motion.div 
                            key="verifying"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-12 text-center"
                        >
                            <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-teal-500 animate-spin mb-4" />
                            <p className="text-slate-400 font-medium text-sm">Verifierar återställningskod...</p>
                        </motion.div>
                    ) : verificationError ? (
                        <motion.div 
                            key="verification-error"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-6"
                        >
                            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Ett fel uppstod</h2>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed px-2">
                                {verificationError}
                            </p>
                            <button
                                onClick={handleGoToLogin}
                                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4" /> Det går bra att logga in ändå
                            </button>
                        </motion.div>
                    ) : success ? (
                        <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center py-6"
                        >
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Klart!</h2>
                            <p className="text-slate-400 text-sm mb-8 leading-relaxed px-2">
                                Ditt lösenord har uppdaterats framgångsrikt. Du kan nu logga in med ditt nya lösenord.
                            </p>
                            <button
                                onClick={handleGoToLogin}
                                className="w-full bg-teal-500 hover:bg-teal-400 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 uppercase tracking-widest text-sm"
                            >
                                Till inloggningen
                            </button>
                        </motion.div>
                    ) : (
                        <motion.form 
                            key="form"
                            onSubmit={handleSubmit}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Nytt lösenord</h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Välj ett nytt lösenord för kontot <strong className="text-slate-200">{email}</strong>
                                </p>
                            </div>

                            {submitError && (
                                <div className="bg-red-500/10 border border-red-500 px-4 py-3 rounded-xl text-sm text-red-400 font-medium flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            {/* New Password input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block" htmlFor="new-password">
                                    Nytt lösenord
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Lock className="w-5 h-5" />
                                    </span>
                                    <input
                                        id="new-password"
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minst 6 tecken"
                                        required
                                        className="w-full bg-black text-white p-4 pl-12 pr-12 rounded-xl border border-slate-800 focus:border-teal-500 focus:outline-none transition text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block" htmlFor="confirm-new-password">
                                    Bekräfta lösenord
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Lock className="w-5 h-5" />
                                    </span>
                                    <input
                                        id="confirm-new-password"
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Upprepa lösenordet"
                                        required
                                        className="w-full bg-black text-white p-4 pl-12 pr-12 rounded-xl border border-slate-800 focus:border-teal-500 focus:outline-none transition text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-teal-500 hover:bg-teal-400 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 uppercase tracking-widest text-sm disabled:opacity-50"
                            >
                                {submitting ? 'Sparar...' : 'Spara nya lösenordet'}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
