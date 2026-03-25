import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { auth, db } from '../services/firebaseService'; // Importera auth direkt
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Importera Firebase-metoden direkt
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CloseIcon, EyeIcon, EyeOffIcon } from './icons';

interface RegisterGymScreenProps {
    onCancel: () => void;
}

export const RegisterGymScreen: React.FC<RegisterGymScreenProps> = ({ onCancel }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [gymName, setGymName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Skapa användaren i Firebase Auth (direkt anrop för att undvika hook-fel)
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Skapa en ny organisation
            const orgRef = doc(collection(db, "organizations"));
            const orgId = orgRef.id;

            await setDoc(orgRef, {
                id: orgId,
                name: gymName,
                createdAt: serverTimestamp(),
                ownerUid: user.uid,
                maxFreeCoaches: 5,
                subdomain: gymName.toLowerCase().replace(/\s+/g, '-'),
                globalConfig: {
                    primaryColor: '#6366f1',
                    enableWorkoutLogging: true,
                    enableScreensaver: true
                },
                // Lägger till standardlösenord för att matcha er Organizations-typ
                passwords: {
                    admin: '1234',
                    coach: '1234'
                }
            });

            // 3. Skapa användarprofilen i Firestore
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email,
                firstName,
                lastName,
                organizationId: orgId,
                role: 'organizationadmin',
                systemFeePaid: false, // Detta triggar WelcomePaywall i App.tsx
                createdAt: serverTimestamp()
            });

            // OBS: Vi behöver inte navigera manuellt. 
            // App.tsx kommer känna av den nya inloggade användaren och visa WelcomePaywall.

        } catch (err: any) {
            console.error(err);
            // Översätt vanliga felmeddelanden
            if (err.code === 'auth/email-already-in-use') {
                setError("E-postadressen används redan av ett annat konto.");
            } else if (err.code === 'auth/weak-password') {
                setError("Lösenordet är för svagt. Välj minst 6 tecken.");
            } else {
                setError(err.message || "Ett fel uppstod vid registreringen.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4 w-full">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg p-8 relative"
            >
                <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Registrera ditt gym</h2>
                    <p className="text-gray-400 mt-2">Börja använda Smart Skärm i din verksamhet idag.</p>
                </div>

                {error && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm text-center font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Gymmet / Företagets Namn</label>
                        <input
                            type="text"
                            required
                            value={gymName}
                            onChange={(e) => setGymName(e.target.value)}
                            placeholder="t.ex. Flexibel Fitness"
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Ditt Förnamn</label>
                            <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Anna"
                                className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Efternamn</label>
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Andersson"
                                className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">E-post (Inloggning)</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="namn@gym.se"
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 tracking-wider">Välj Lösenord</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Minst 6 tecken"
                                className="w-full bg-black text-white p-3 pr-12 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none p-1"
                                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
                            >
                                {showPassword ? (
                                    <EyeOffIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:brightness-110 text-white font-black py-4 rounded-lg mt-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 active:scale-[0.98]"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>SKAPAR KONTO...</span>
                                </div>
                            ) : (
                                'SKAPA GYMKONTO'
                            )}
                        </button>
                    </div>
                </form>

                <p className="text-[10px] text-gray-600 mt-6 text-center leading-relaxed">
                    Genom att registrera dig skapar du en ny organisation i Smart Skärm. Systemavgiften betalas i nästa steg för att aktivera ditt medlemskap.
                </p>
            </motion.div>
        </div>
    );
};
