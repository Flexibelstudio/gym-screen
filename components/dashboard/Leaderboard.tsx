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
    const [leaderboard, setLeaderboard] = useState<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number, sisu: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workouts' | 'pbs' | 'sisu'>('workouts');
    
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
                    
                    // Filtrera loggar för den här veckan, rätt studio-krav, samt rätt ort om valt
                    const weeklyLogs = logs.filter(log => {
                        const logTime = log.date;
                        const isThisWeek = logTime >= startMs && logTime <= endMs;
                        const isStudio = log.inStudio !== false;
                        const isShown = log.showOnLeaderboard !== false;
                        
                        // Hitta medlemmens nuvarande ort från medlemslistan som fallback om logens ort är null/saknas
                        const member = memberMap.get(log.memberId);
                        const userLocationId = log.locationId || member?.locationId || 'all';

                        const matchesLocation = selectedLocationId === 'all' || userLocationId === selectedLocationId;
                        return isThisWeek && isStudio && isShown && matchesLocation && !optedOutMemberIds.has(log.memberId);
                    });
                    
                    // Gruppera per medlem
                    const counts: Record<string, { count: number, pbs: number, sisu: number }> = {};
                    weeklyLogs.forEach(log => {
                        const mId = log.memberId;
                        if (!counts[mId]) {
                            counts[mId] = { count: 0, pbs: 0, sisu: 0 };
                        }
                        counts[mId].count += 1;
                        counts[mId].pbs += (log.newPBs || []).length;

                        // Beräkna sisu-poäng för denna logg
                        let pts = log.summerPoints;
                        if (pts === undefined) {
                            const isOfficial = log.workoutId && log.workoutId !== 'manual' && !log.workoutId.startsWith('custom_') && !log.workoutId.startsWith('custom-');
                            pts = isOfficial ? 3 : (log.inStudio === true ? 2 : 1);
                        }
                        counts[mId].sisu += pts;
                    });
                    
                    const leaderboardData = Object.entries(counts).map(([mId, stats]) => {
                        const memberInfo = memberMap.get(mId);
                        return {
                            memberId: mId,
                            name: memberInfo 
                                ? `${memberInfo.firstName || 'Medlem'} ${memberInfo.lastName ? memberInfo.lastName[0] + '.' : ''}`.trim()
                                : (weeklyLogs.find(l => l.memberId === mId)?.memberName || 'Okänd Medlem'),
                            photoUrl: memberInfo?.photoUrl || weeklyLogs.find(l => l.memberId === mId)?.memberPhotoUrl || '',
                            count: stats.count,
                            pbs: stats.pbs,
                            sisu: stats.sisu
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
        return (b.sisu || 0) - (a.sisu || 0);
    });
    const displayData = (activeTab === 'pbs' ? sortedData.filter(u => u.pbs > 0) : sortedData).slice(0, 10);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" /> Veckans Topplista
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
                <button
                    onClick={() => setActiveTab('workouts')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'workouts' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <ChartBarIcon className="w-3.5 h-3.5" /> Pass
                </button>
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
                    onClick={() => setActiveTab('pbs')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'pbs' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <FireIcon className="w-3.5 h-3.5" /> PB
                </button>
            </div>
            
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider font-bold">
                Endast pass utförda på {selectedLocationId !== 'all' ? selectedOrganization?.locations?.find(l => l.id === selectedLocationId)?.name || 'plats' : selectedOrganization?.name || 'plats'} räknas
            </p>
            
            {displayData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                    {activeTab === 'workouts' ? 'Inga pass loggade denna vecka än.' : activeTab === 'sisu' ? 'Inga Sisu-poäng intjänade denna vecka än.' : 'Inga personbästan satta denna vecka än.'}
                </p>
            ) : (
                <div className="space-y-3">
                    {displayData.map((user, index) => (
                        <div key={user.memberId} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
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
                                        ☀️ {user.sisu || 0} p
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
