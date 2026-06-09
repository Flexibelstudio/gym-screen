import React, { useEffect, useState } from 'react';
import { listenToLeaderboardLogs, getMembers } from '../../services/firebaseService';
import { TrophyIcon, FireIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { useStudio } from '../../context/StudioContext';
import { useAuth } from '../../context/AuthContext';

interface LeaderboardProps {
    organizationId: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ organizationId }) => {
    const { selectedOrganization, studioConfig } = useStudio();
    const { userData } = useAuth();
    const [leaderboard, setLeaderboard] = useState<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number, sisuWeekly: number, sisuTotal: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workouts' | 'pbs' | 'sisu'>('workouts');
    const [sisuTimeframe, setSisuTimeframe] = useState<'weekly' | 'total'>('weekly');
    
    const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
    const [hasInitialized, setHasInitialized] = useState(false);

    const isSummerActive = !!(studioConfig?.enableSummerChallenge || selectedOrganization?.globalConfig?.enableSummerChallenge);

    useEffect(() => {
        if (userData?.locationId) {
            setSelectedLocationId(userData.locationId);
            setHasInitialized(true);
        } else if (!hasInitialized && selectedOrganization?.locations && selectedOrganization.locations.length > 0) {
            setSelectedLocationId('all');
            setHasInitialized(true);
        }
    }, [userData?.locationId, selectedOrganization, hasInitialized]);

    useEffect(() => {
        if (!organizationId) return;

        let unsubscribeLogs: () => void;

        const setupLeaderboard = async () => {
            setLoading(true);
            try {
                const members = await getMembers(organizationId);
                
                // Map uid -> member so we can easily check their current location and details
                const memberMap = new Map<string, any>();
                members.forEach(m => {
                    memberMap.set(m.uid, m);
                });

                // Filter out members who opted out
                const optedOutMemberIds = new Set(
                    members.filter(m => m.showOnLeaderboard === false).map(m => m.uid)
                );

                unsubscribeLogs = listenToLeaderboardLogs(organizationId, 300, (logs) => {
                    // Räkna ut veckans start och slut (måndag till söndag)
                    const now = new Date();
                    const currentDay = now.getDay() || 7; // 1 = måndag, ..., 7 = söndag
                    const monday = new Date(now);
                    monday.setDate(now.getDate() - (currentDay - 1));
                    monday.setHours(0, 0, 0, 0);
                    
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    sunday.setHours(23, 59, 59, 999);
                    
                    const startMs = monday.getTime();
                    const endMs = sunday.getTime();
                    
                    // Gruppera per medlem
                    const counts: Record<string, { count: number, pbs: number, sisuWeekly: number, sisuTotal: number }> = {};
                    
                    logs.forEach(log => {
                        const mId = log.memberId;
                        if (optedOutMemberIds.has(mId)) return;
                        if (log.showOnLeaderboard === false) return;

                        // Hitta medlemmens nuvarande ort från medlemslistan som fallback om logens ort är null/saknas
                        const member = memberMap.get(mId);
                        const userLocationId = log.locationId || member?.locationId || 'all';

                        const matchesLocation = selectedLocationId === 'all' || userLocationId === selectedLocationId;
                        if (!matchesLocation) return;

                        if (!counts[mId]) {
                            counts[mId] = { count: 0, pbs: 0, sisuWeekly: 0, sisuTotal: 0 };
                        }

                        const logTime = log.date;
                        const isThisWeek = logTime >= startMs && logTime <= endMs;

                        // 1. Pass & PB (Endast den här veckan, och endast i studion [i.e. inStudio !== false])
                        if (isThisWeek && log.inStudio !== false) {
                            counts[mId].count += 1;
                            counts[mId].pbs += (log.newPBs || []).length;
                        }

                        // 2. Beräkna sisu-poäng för denna logg med den nya, förenklade regeln:
                        // 2 poäng i studion, 1 poäng utanför studion (minst 30 min)
                        let pts = 0;
                        if (log.inStudio === true) {
                            pts = 2;
                        } else {
                            const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
                            if (!isLessThan30) {
                                pts = 1;
                            }
                        }

                        if (pts > 0) {
                            counts[mId].sisuTotal += pts;
                            if (isThisWeek) {
                                counts[mId].sisuWeekly += pts;
                            }
                        }
                    });
                    
                    const leaderboardData = Object.entries(counts).map(([mId, stats]) => {
                        const memberInfo = memberMap.get(mId);
                        return {
                            memberId: mId,
                            name: memberInfo 
                                ? `${memberInfo.firstName || 'Medlem'} ${memberInfo.lastName ? memberInfo.lastName[0] + '.' : ''}`.trim()
                                : (logs.find(l => l.memberId === mId)?.memberName || 'Okänd Medlem'),
                            photoUrl: memberInfo?.photoUrl || logs.find(l => l.memberId === mId)?.memberPhotoUrl || '',
                            count: stats.count,
                            pbs: stats.pbs,
                            sisuWeekly: stats.sisuWeekly,
                            sisuTotal: stats.sisuTotal
                        };
                    });
                    
                    setLeaderboard(leaderboardData);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Failed to setup leaderboard", error);
                setLoading(false);
            }
        };

        setupLeaderboard();

        return () => {
            if (unsubscribeLogs) {
                unsubscribeLogs();
            }
        };
    }, [organizationId, selectedLocationId]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const sortedData = [...leaderboard].sort((a, b) => {
        if (activeTab === 'workouts') return b.count - a.count;
        if (activeTab === 'pbs') return b.pbs - a.pbs;
        if (sisuTimeframe === 'weekly') {
            return (b.sisuWeekly || 0) - (a.sisuWeekly || 0);
        } else {
            return (b.sisuTotal || 0) - (a.sisuTotal || 0);
        }
    });

    const displayData = (() => {
        if (activeTab === 'pbs') {
            return sortedData.filter(u => u.pbs > 0);
        }
        if (activeTab === 'sisu') {
            if (sisuTimeframe === 'weekly') {
                return sortedData.filter(u => u.sisuWeekly > 0);
            } else {
                return sortedData.filter(u => u.sisuTotal > 0);
            }
        }
        return sortedData;
    })().slice(0, 10);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" />{' '}
                    {activeTab === 'sisu' 
                        ? (sisuTimeframe === 'total' ? 'Sommarutmaningen - Totalt' : 'Sommarutmaningen - Denna Vecka')
                        : 'Veckans Topplista'
                    }
                </h3>
            </div>

            {/* Platsväljare som snygga pills/capsules - visas endast om användaren inte har en tilldelad studio */}
            {!userData?.locationId && selectedOrganization?.locations && selectedOrganization.locations.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-4 p-1 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-800">
                    <button
                        onClick={() => setSelectedLocationId('all')}
                        className={`flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            selectedLocationId === 'all'
                                ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        Alla
                    </button>
                    {selectedOrganization.locations.map(loc => {
                        const isSelected = selectedLocationId === loc.id;
                        return (
                            <button
                                key={loc.id}
                                onClick={() => setSelectedLocationId(loc.id)}
                                className={`flex-1 py-1.5 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all truncate ${
                                    isSelected
                                        ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {loc.name}
                            </button>
                        );
                    })}
                </div>
            )}
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
                {isSummerActive && (
                    <button
                        onClick={() => setActiveTab('sisu')}
                        className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'sisu' ? 'bg-white dark:bg-gray-700 text-amber-500 shadow-sm font-black' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        ☀️ Sisu
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('workouts')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'workouts' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <ChartBarIcon className="w-3.5 h-3.5" /> Pass
                </button>
                <button
                    onClick={() => setActiveTab('pbs')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'pbs' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <FireIcon className="w-3.5 h-3.5" /> PB
                </button>
            </div>

            {/* Veckovis vs Totalt för SISU */}
            {activeTab === 'sisu' && (
                <div className="flex gap-1.5 mb-4 p-1 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/10 shadow-sm transition-all">
                    <button
                        onClick={() => setSisuTimeframe('weekly')}
                        className={`flex-1 py-1 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            sisuTimeframe === 'weekly'
                                ? 'bg-amber-500 text-white shadow-md'
                                : 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 font-bold'
                        }`}
                    >
                        Veckovis
                    </button>
                    <button
                        onClick={() => setSisuTimeframe('total')}
                        className={`flex-1 py-1 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                            sisuTimeframe === 'total'
                                ? 'bg-amber-500 text-white shadow-md'
                                : 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 font-bold'
                        }`}
                    >
                        Totalt
                    </button>
                </div>
            )}
            
            {activeTab !== 'sisu' && (
                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider font-bold">
                    Endast pass utförda på {selectedLocationId !== 'all' ? selectedOrganization?.locations?.find(l => l.id === selectedLocationId)?.name || 'plats' : selectedOrganization?.name || 'plats'} räknas
                </p>
            )}
            
            {displayData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                    {activeTab === 'workouts' 
                        ? 'Inga pass loggade denna vecka än.' 
                        : activeTab === 'sisu' 
                            ? (sisuTimeframe === 'weekly' ? 'Inga Sisu-poäng intjänade denna vecka än.' : 'Inga Sisu-poäng intjänade än under utmaningen.') 
                            : 'Inga personbästan satta denna vecka än.'
                    }
                </p>
            ) : (
                <div className="space-y-3">
                    {displayData.map((user, index) => (
                        <div key={user.memberId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black
                                    ${index === 0 ? 'bg-yellow-100 text-yellow-600' : 
                                      index === 1 ? 'bg-gray-200 text-gray-600' : 
                                      index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-transparent text-gray-400'}
                                `}>
                                    {index + 1}
                                </div>
                                {user.photoUrl ? (
                                    <img src={user.photoUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">
                                        {user.name.charAt(0)}
                                    </div>
                                )}
                                <span className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {activeTab === 'workouts' ? (
                                    <div className="text-sm font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                        {user.count} pass
                                    </div>
                                ) : activeTab === 'sisu' ? (
                                    <div className="text-sm font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                        ☀️ {sisuTimeframe === 'weekly' ? user.sisuWeekly : user.sisuTotal} p
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-sm font-black text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg">
                                        <FireIcon className="w-4 h-4" /> {user.pbs} PB
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
