import React, { useEffect, useState } from 'react';
import { getLeaderboardData, getMembers } from '../../services/firebaseService';
import { TrophyIcon, FireIcon } from '@heroicons/react/24/solid';

interface LeaderboardProps {
    organizationId: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ organizationId }) => {
    const [leaderboard, setLeaderboard] = useState<{ memberId: string, name: string, photoUrl: string, count: number, pbs: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const [data, members] = await Promise.all([
                    getLeaderboardData(organizationId),
                    getMembers(organizationId)
                ]);

                // Filter out members who opted out
                const optedOutMemberIds = new Set(
                    members.filter(m => m.showOnLeaderboard === false).map(m => m.uid)
                );

                const filteredData = data.filter(d => !optedOutMemberIds.has(d.memberId));
                setLeaderboard(filteredData.slice(0, 10)); // Top 10
            } catch (error) {
                console.error("Failed to fetch leaderboard", error);
            } finally {
                setLoading(false);
            }
        };

        if (organizationId) {
            fetchLeaderboard();
        }
    }, [organizationId]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex justify-center items-center h-48">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <TrophyIcon className="w-5 h-5 text-yellow-500" /> Veckans Topplista
            </h3>
            
            {leaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Inga pass loggade denna vecka än.</p>
            ) : (
                <div className="space-y-3">
                    {leaderboard.map((user, index) => (
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
                                {user.pbs > 0 && (
                                    <div className="flex items-center gap-1 text-xs font-bold text-orange-500">
                                        <FireIcon className="w-3 h-3" /> {user.pbs} PR
                                    </div>
                                )}
                                <div className="text-sm font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                                    {user.count} pass
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
