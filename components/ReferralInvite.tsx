
import React, { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';
import { Organization, UserData } from '../types';
import { buildReferralUrl } from '../utils/workoutUtils';
import { incrementReferralShares } from '../services/firebaseService';
import { CloseIcon, UsersIcon } from './icons';

/**
 * Värva en vän.
 *
 * Vi lagrar aldrig kompisens uppgifter — hon fyller i gymmets eget formulär och
 * datan hamnar i gymmets CRM. Det vi gör är att presentera länken snyggt och
 * skicka med vem som värvade och vilken ort, så att gymmet vet vem som ska
 * belönas utan att kompisen behöver gissa.
 *
 * QR-koden bär samma förifyllning som länken. Annars tappas värvaren just i det
 * läge som är starkast: när kompisen står bredvid i lokalen.
 */

interface ReferralInviteProps {
    organization?: Organization | null;
    userData: UserData;
}

const buildDisplayName = (userData: UserData): string => {
    const first = (userData.firstName || '').trim();
    const last = (userData.lastName || '').trim();
    if (first && last) return `${first} ${last.charAt(0)}.`;
    if (first) return first;
    return (userData.email || '').split('@')[0] || 'En medlem';
};

export const ReferralInvite: React.FC<ReferralInviteProps> = ({ organization, userData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const referral = organization?.referral;

    const locationName = useMemo(() => {
        if (!userData.locationId || !organization?.locations) return null;
        return organization.locations.find(l => l.id === userData.locationId)?.name || null;
    }, [userData.locationId, organization?.locations]);

    // Ortens egen länk går före organisationens.
    const baseUrl = useMemo(() => {
        const ownLocation = organization?.locations?.find(l => l.id === userData.locationId);
        return (ownLocation?.referralUrl || '').trim() || referral?.url || null;
    }, [organization?.locations, userData.locationId, referral?.url]);

    const shareUrl = useMemo(() => buildReferralUrl({
        baseUrl,
        referrerParam: referral?.referrerParam,
        locationParam: referral?.locationParam,
        referrerName: buildDisplayName(userData),
        locationName,
    }), [baseUrl, referral?.referrerParam, referral?.locationParam, userData, locationName]);

    if (!referral?.enabled || !shareUrl) return null;

    // Det ska aldrig kunna läsas som en inbjudan till appen. Man bjuder in
    // någon att träna hos gymmet — därför står gymmets eller ortens namn i
    // rubriken så fort vi vet det.
    const placeName = organization?.name || null;
    const title = referral.title?.trim()
        || (placeName ? `Träna med en vän hos ${placeName}` : 'Träna med en vän');
    const description = referral.description?.trim()
        || (placeName
            ? `Visa koden för din kompis så kan hon anmäla sig till ett pass hos ${placeName}.`
            : 'Visa koden för din kompis så kan hon anmäla sig till ett pass hos oss.');
    const shareCount = userData.referralShares || 0;

    // Räknaren får aldrig stå i vägen för själva delningen.
    const countShare = () => { incrementReferralShares(userData.uid); };

    const handleShare = async () => {
        countShare();
        const shareData = { title, text: description, url: shareUrl };
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            try {
                await (navigator as any).share(shareData);
                return;
            } catch {
                // Avbruten delning är inget fel — vi faller tillbaka på kopiering.
            }
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            window.open(shareUrl, '_blank', 'noopener');
        }
    };

    return (
        <>
            {/* Låg rad på startsidan. Ska gå att hitta på två sekunder när
                kompisen står bredvid, utan att tävla med siffrorna ovanför. */}
            <button
                onClick={() => { setIsOpen(true); countShare(); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm text-left active:scale-[0.99] transition-transform"
            >
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <UsersIcon className="w-5 h-5" />
                </span>
                <span className="flex-grow min-w-0">
                    <span className="block font-black text-gray-900 dark:text-white leading-tight">{title}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{description}</span>
                </span>
                {shareCount > 0 && (
                    <span className="flex-shrink-0 text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                        {shareCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.98 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-2xl border border-gray-200 dark:border-gray-800 relative"
                        >
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                aria-label="Stäng"
                            >
                                <CloseIcon className="w-6 h-6" />
                            </button>

                            <h2 className="text-xl font-black text-gray-900 dark:text-white pr-8">{title}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>

                            {/* Vit platta bakom koden — QR läses sämre mot mörkt. */}
                            <div className="mt-6 bg-white p-5 rounded-2xl flex items-center justify-center border border-gray-200">
                                <QRCode value={shareUrl} size={200} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
                            </div>

                            <p className="mt-3 text-center text-xs text-gray-400">
                                Din vän skannar koden med kameran och anmäler sig
                                {placeName ? ` till ${placeName}` : ''}
                            </p>

                            <div className="mt-5 flex flex-col gap-2">
                                <button
                                    onClick={handleShare}
                                    className="w-full py-3.5 rounded-2xl bg-primary text-white font-black active:scale-[0.98] transition-transform"
                                >
                                    {copied ? 'Länken är kopierad' : 'Dela länken'}
                                </button>
                                <a
                                    href={shareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={countShare}
                                    className="w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-center font-bold text-gray-600 dark:text-gray-300"
                                >
                                    Öppna formuläret
                                </a>
                            </div>

                            {shareCount > 0 && (
                                <p className="mt-4 text-center text-xs font-bold text-gray-400">
                                    Du har delat {shareCount} {shareCount === 1 ? 'gång' : 'gånger'}
                                </p>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
