
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createLead } from '../services/firebaseService';

/**
 * KlubbSverige-ingång.
 *
 * Egen sida på /klubbsverige som inte länkas från någon publik meny. Länken
 * sprids bara via KlubbSveriges egna kanaler — det är i praktiken medlems-
 * spärren. Erbjudandet får enligt avtalet inte visas på den publika sajten.
 *
 * Formuläret skriver till samma leads-samling som landningssidan, men taggat
 * med source = 'klubbsverige' så att attributionen går att följa. Org.nr samlas
 * in för att kunna stämmas av mot medlemsregistret; verifieringen sker manuellt
 * i admin i version ett.
 */
export const KlubbSverigeScreen: React.FC = () => {
    const campaignCode = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('kod') || params.get('code') || '';
    }, []);

    const [gymName, setGymName] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [screens, setScreens] = useState('');
    const [message, setMessage] = useState('');
    const [code, setCode] = useState(campaignCode);

    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = gymName.trim() && name.trim() && email.trim() && phone.trim();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || isSending) return;
        setIsSending(true);
        setError(null);
        try {
            const parsedScreens = parseInt(screens, 10);
            const ok = await createLead({
                name: name.trim(),
                email: email.trim(),
                gymName: gymName.trim(),
                phone: phone.trim(),
                message: message.trim() || undefined,
                source: 'klubbsverige',
                campaignCode: code.trim() || undefined,
                memberVerified: false,
                screensInterested: Number.isFinite(parsedScreens) && parsedScreens > 0 ? parsedScreens : undefined,
            } as any);
            if (ok) {
                setIsSent(true);
            } else {
                setError('Något gick fel. Försök igen, eller mejla oss på hej@smartstudio.se.');
            }
        } catch {
            setError('Något gick fel. Försök igen, eller mejla oss på hej@smartstudio.se.');
        } finally {
            setIsSending(false);
        }
    };

    const fieldClass = "w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary";
    const labelClass = "block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5";

    if (isSent) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center shadow-xl"
                >
                    <div className="text-5xl mb-4">🎉</div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Tack! Vi hör av oss</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Vi kontaktar dig inom kort för att boka in en demo och stämmer av ert
                        medlemskap i KlubbSverige, så att ni får rätt pris direkt.
                    </p>

                    {/* De flesta kommer hit direkt från nyhetsbrevet och har aldrig sett
                        produkten. Utan den här vägen vidare slutar besöket i en
                        återvändsgränd just när nyfikenheten är som störst. Formuläret
                        lägger vi däremot inte tillbaka — det bjuder bara in till dubbletter. */}
                    <a
                        href="/"
                        className="mt-6 inline-block w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Se hur SmartStudio fungerar
                    </a>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black py-10 px-4">
            <div className="max-w-xl mx-auto">
                <div className="flex items-center gap-2.5 mb-8">
                    <img src="/favicon.png" alt="SmartStudio" className="w-10 h-10 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700" referrerPolicy="no-referrer" />
                    <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">SmartStudio</span>
                </div>

                <span className="inline-block py-1.5 px-4 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest mb-4">
                    Exklusivt för KlubbSverige
                </span>

                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                    15 % rabatt på SmartStudio
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                    Som medlem i KlubbSverige får ni 15 % rabatt på mjukvaran, på gällande pris.
                    Fyll i formuläret så kontaktar vi er och bokar in en demo — vi visar systemet,
                    svarar på frågor och ger er ert pris. Ingen kostnad och inget åtagande.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <div>
                        <label className={labelClass}>Anläggningens namn *</label>
                        <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} required className={fieldClass} />
                    </div>

                    <div>
                        <label className={labelClass}>Kontaktperson *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required className={fieldClass} />
                    </div>

                    <div>
                        <label className={labelClass}>E-post *</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={fieldClass} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Telefon *</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className={fieldClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Antal skärmar</label>
                            <input type="number" min="1" value={screens} onChange={e => setScreens(e.target.value)} placeholder="t.ex. 2" className={fieldClass} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Meddelande</label>
                        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className={fieldClass} />
                    </div>

                    <div>
                        <label className={labelClass}>Kampanjkod</label>
                        <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="Fylls i automatiskt via länken" className={fieldClass} />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm font-bold text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit || isSending}
                        className="w-full py-4 rounded-2xl bg-primary text-white font-black text-lg disabled:opacity-50 active:scale-[0.99] transition-transform"
                    >
                        {isSending ? 'Skickar…' : 'Boka en demo'}
                    </button>

                    <p className="text-xs text-gray-400 text-center">
                        Vi använder uppgifterna för att kontakta er om en demo av SmartStudio. Inget annat.
                    </p>
                </form>
            </div>
        </div>
    );
};
