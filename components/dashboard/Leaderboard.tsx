import React, { useEffect, useState } from 'react';
import { listenToLeaderboardData, getMembers } from '../../services/firebaseService';
import { TrophyIcon, FireIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { useStudio } from '../../context/StudioContext';

interface LeaderboardProps {
    organizationId: string;
    locationId?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ organizationId, locationId }) => {
    const { selectedOrganization } = useStudio();
    const [leaderboard, setLeaderboard] = useState<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workouts' | 'pbs'>('workouts');

    useEffect(() => {
        if (!organizationId) return;

        let unsubscribeLeaderboard: () => void;

        const setupLeaderboard = async () => {
            setLoading(true);
            try {
                const members = await getMembers(organizationId);
                
                // Filter out members who opted out AND who are not in the same location (if locationId is set)
                const excludedMemberIds = new Set(
                    members.filter(m => 
                        m.showOnLeaderboard === false || 
                        (locationId && m.locationId !== locationId)
                    ).map(m => m.uid)
                );

                unsubscribeLeaderboard = listenToLeaderboardData(organizationId, (data) => {
                    const filteredData = data.filter(d => !excludedMemberIds.has(d.memberId));
                    setLeaderboard(filteredData);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Failed to setup leaderboard", error);
                setLoading(false);
            }
        };

        setupLeaderboard();

        return () => {
            if (unsubscribeLeaderboard) {
                unsubscribeLeaderboard();
            }
        };
    }, [organizationId]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const sortedData = [...leaderboard].sort((a, b) => activeTab === 'workouts' ? b.count - a.count : b.pbs - a.pbs);
    const displayData = (activeTab === 'pbs' ? sortedData.filter(u => u.pbs > 0) : sortedData).slice(0, 10);

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" /> Veckans Topplista
                </h3>
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
                <button
                    onClick={() => setActiveTab('workouts')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'workouts' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <ChartBarIcon className="w-4 h-4" /> Pass
                </button>
                <button
                    onClick={() => setActiveTab('pbs')}
                    className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'pbs' ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <FireIcon className="w-4 h-4" /> PB
                </button>
            </div>
            
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider font-bold">
                {locationId 
                    ? `Visar resultat för ${selectedOrganization?.locations?.find(l => l.id === locationId)?.name || 'din anläggning'}` 
                    : `Endast pass utförda på ${selectedOrganization?.name || 'plats'} räknas`}
            </p>
            
            {displayData.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                    {activeTab === 'workouts' ? 'Inga pass loggade denna vecka än.' : 'Inga personbästan satta denna vecka än.'}
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
