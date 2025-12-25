import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
    const { signIn, sendPasswordResetEmail } = useAuth();
    const [view, setView] = useState<'login' | 'reset'>('login');
    
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
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
            // Don't reveal if an email exists or not for security reasons.
            setResetSuccess(`En återställningslänk har skickats till ${resetEmail} om kontot finns.`);
        } finally {
            setResetLoading(false);
        }
    };

    const renderLoginView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Logga in som administratör</h2>
                <p className="text-gray-400 mt-1">För systemägare och organisationsadmin</p>
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

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

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
        </>
    );

    const renderResetView = () => (
        <>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Återställ lösenord</h2>
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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
            <div className="w-full max-w-md">
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8">
                    {view === 'login' ? renderLoginView() : renderResetView()}
                </div>
            </div>
        </div>
    );
};