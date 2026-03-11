import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebaseService';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CloseIcon } from './icons';

interface RegisterGymScreenProps {
    onCancel: () => void;
}

export const RegisterGymScreen: React.FC<RegisterGymScreenProps> = ({ onCancel }) => {
    const { signUp } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [gymName, setGymName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Skapa användaren i Auth
            const userCredential = await signUp(email, password);
            const user = userCredential.user;

            // 2. Skapa en ny organisation
            const orgRef = doc(collection(db, "organizations"));
            const orgId = orgRef.id;

            await setDoc(orgRef, {
                id: orgId,
                name: gymName,
                createdAt: serverTimestamp(),
                ownerUid: user.uid,
                subdomain: gymName.toLowerCase().replace(/\s+/g, '-'),
                globalConfig: {
                    primaryColor: '#6366f1',
                    enableWorkoutLogging: true,
                    enableScreensaver: true
                }
            });

            // 3. Skapa användarprofilen
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email,
                firstName,
                lastName,
                organizationId: orgId,
                role: 'organizationadmin',
                systemFeePaid: false, // Detta triggar WelcomePaywall
                createdAt: serverTimestamp()
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Ett fel uppstod vid registreringen.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg p-8 relative"
            >
                <button onClick={onCancel} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <CloseIcon className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white">Registrera ditt gym</h2>
                    <p className="text-gray-400 mt-2">Börja använda Smart Skärm i din verksamhet idag.</p>
                </div>

                {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">{error}</div>}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Gymmet / Företagets Namn</label>
                        <input
                            type="text"
                            required
                            value={gymName}
                            onChange={(e) => setGymName(e.target.value)}
                            placeholder="t.ex. Flexibel Fitness"
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ditt Förnamn</label>
                            <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Efternamn</label>
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-post (Inloggning)</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Välj Lösenord</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minst 6 tecken"
                            className="w-full bg-black text-white p-3 rounded-md border border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:brightness-110 text-white font-bold py-4 rounded-lg mt-4 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Skapar konto...' : 'SKAPA GYMKONTO'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};