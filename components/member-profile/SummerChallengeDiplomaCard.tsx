import React from 'react';
import { getSisuAchievementTitle } from './profileHelpers';

interface SummerChallengeDiplomaCardProps {
    userData: any;
    stats: any;
    summerStats: any;
    grandTotalPoints: number;
    userRankIndex: number;
    challengeTitle: string;
    organizationName?: string;
    endDate?: number;
    onClose: () => void;
}

export const SummerChallengeDiplomaCard: React.FC<SummerChallengeDiplomaCardProps> = ({
    userData,
    stats,
    summerStats,
    grandTotalPoints,
    userRankIndex,
    challengeTitle,
    organizationName,
    endDate,
    onClose
}) => {
    // Clean, formatted date
    const endDateStr = endDate 
        ? new Date(endDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }) 
        : '';
        
    const achieved = getSisuAchievementTitle(stats.summerTotalPoints);
    
    // Rank number
    const rankNum = userRankIndex !== -1 ? userRankIndex + 1 : null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
            {/* Modal Glass Panel Container */}
            <div className="relative w-full max-w-xl animate-fade-in py-6 sm:py-8 flex flex-col items-center">
                
                {/* Close button above diploma */}
                <button
                    onClick={onClose}
                    className="absolute -top-3 -right-3 sm:top-1 sm:right-1 z-50 bg-black/50 hover:bg-black/80 text-white/90 hover:text-white p-2.5 rounded-full transition-all border border-white/10 shadow-lg cursor-pointer flex items-center justify-center"
                    title="Stäng"
                >
                    <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* The actual shareable certificate (designed to be beautifully proportioned) */}
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-500 to-amber-950 text-white rounded-[2.5rem] p-7 sm:p-10 border-4 sm:border-8 border-amber-300/40 border-double shadow-[0_20px_50px_rgba(249,115,22,0.35)] select-none text-center w-full">
                    {/* Vintage star bursts backdrop glow */}
                    <div className="absolute top-[-80px] left-[-80px] w-96 h-96 bg-white/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-amber-400/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    {/* Double frame lines to feel authentic */}
                    <div className="absolute inset-3 border border-white/10 rounded-[2rem] pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-5 sm:space-y-6">
                        {/* Header Seal */}
                        <div className="flex flex-col items-center justify-center space-y-2 pt-1">
                            <div className="w-14 h-14 bg-white/10 border-2 border-amber-300 rounded-full flex items-center justify-center text-3xl shadow-md rotate-12">
                                ☀️
                            </div>
                            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-amber-200/90 leading-none pt-1">Officiellt Hedersdiplom</span>
                        </div>
                        
                        {/* Decorative separators */}
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-300"></div>
                            <span className="text-amber-300 text-sm">🏆</span>
                            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-300"></div>
                        </div>
                        
                        {/* Participant Name */}
                        <div className="space-y-0.5 py-0.5">
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-200/70 tracking-widest block">Tilldelas härmed</span>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white capitalize font-sans drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] leading-tight">
                                {`${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || userData?.name || userData?.displayName || 'Sisu-kämpe'}
                            </h2>
                        </div>

                        {/* Achievement Narrative text */}
                        <p className="text-xs font-medium text-amber-50 max-w-sm mx-auto leading-relaxed">
                            för att framgångsrikt ha genomfört och deltagit i <strong className="text-amber-200 font-extrabold">{challengeTitle}</strong> på ert gym. Med oerhörd uthållighet, glöd och hängivenhet har du bidragit till att lyfta hela studions temperatur till den fantastiska nivån:
                        </p>

                        {/* Studio Heat rating */}
                        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 shadow-inner select-none">
                            <span className="text-[10px] font-bold text-amber-200 font-mono tracking-wider">STUDIO-TEMP:</span>
                            <span className="text-sm font-black bg-amber-500/30 px-1.5 py-0.5 rounded-lg inline-flex items-center gap-1">
                                {summerStats.label} {summerStats.emoji}
                            </span>
                        </div>

                        {/* Achievements Stats Grid */}
                        <div className="grid grid-cols-3 gap-2.5 max-w-sm mx-auto pt-1">
                            <div className="bg-black/15 backdrop-blur-lg p-2.5 rounded-xl border border-white/5 space-y-0.5">
                                <span className="block text-[7px] font-black uppercase text-amber-200/80 tracking-wider">Ditt Bidrag</span>
                                <span className="block text-base font-black leading-none drop-shadow">{stats.summerTotalPoints} p</span>
                            </div>
                            <div className="bg-black/15 backdrop-blur-lg p-2.5 rounded-xl border border-white/5 space-y-0.5">
                                <span className="block text-[7px] font-black uppercase text-amber-200/80 tracking-wider">Din Rank</span>
                                <span className="block text-base font-black leading-none drop-shadow">
                                    {rankNum ? `#${rankNum}` : '–'}
                                </span>
                            </div>
                            <div className="bg-black/15 backdrop-blur-lg p-2.5 rounded-xl border border-white/5 space-y-0.5">
                                <span className="block text-[7px] font-black uppercase text-amber-200/80 tracking-wider">Klubb Total</span>
                                <span className="block text-base font-black leading-none drop-shadow">{grandTotalPoints} p</span>
                            </div>
                        </div>

                        {/* Personalized Title badge */}
                        <div className="inline-block mt-0.5">
                            <div className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 font-black uppercase text-[9px] tracking-widest rounded-full shadow-lg border border-white/20">
                                Prestation: <span className="underline">{achieved.title}</span>
                            </div>
                        </div>

                        {/* Signature / Footer */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4 text-left max-w-sm mx-auto">
                            <div>
                                <span className="block text-[7px] font-bold text-amber-200/70 uppercase">Utfärdat på</span>
                                <span className="block text-[10px] font-semibold text-white truncate max-w-[125px]">{organizationName || userData?.organizationName || 'Ditt Gym'}</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-[7px] font-bold text-amber-200/70 uppercase">Slutdatum</span>
                                <span className="block text-[10px] font-semibold text-white">{endDateStr}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
