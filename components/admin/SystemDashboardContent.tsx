
import React, { useMemo } from 'react';
import { Organization } from '../../types';
import { motion } from 'framer-motion';

// --- Interfaces for Analytics ---
interface HealthStats {
    active: number;   // Green: < 3 days
    warning: number;  // Yellow: 3-14 days
    inactive: number; // Red: > 14 days
}

interface OrgHealthStatus {
    org: Organization;
    daysSinceActive: number;
    status: 'active' | 'warning' | 'inactive';
}

// --- Helper Functions ---
const getHealthStatus = (lastActive: number | undefined): OrgHealthStatus['status'] => {
    // If no data, assume inactive
    if (!lastActive) return 'inactive';
    
    const now = Date.now();
    const daysAgo = (now - lastActive) / (1000 * 60 * 60 * 24);
    
    if (daysAgo <= 3) return 'active';
    if (daysAgo <= 14) return 'warning';
    return 'inactive';
};

const getStatusColor = (status: OrgHealthStatus['status']) => {
    switch(status) {
        case 'active': return 'bg-emerald-500';
        case 'warning': return 'bg-yellow-500';
        case 'inactive': return 'bg-red-500';
    }
};

const getStatusLabel = (status: OrgHealthStatus['status']) => {
    switch(status) {
        case 'active': return 'Aktiv';
        case 'warning': return 'Varning';
        case 'inactive': return 'Inaktiv';
    }
};

// --- Sub-components ---

const MetricCard: React.FC<{ label: string; value: number | string; trend?: string; colorClass?: string }> = ({ label, value, trend, colorClass = "text-gray-900 dark:text-white" }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-4xl font-extrabold tracking-tight ${colorClass}`}>{value}</span>
            {trend && <span className="text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">{trend}</span>}
        </div>
    </div>
);

const HealthList: React.FC<{ orgs: OrgHealthStatus[] }> = ({ orgs }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">Kundhälsa</h3>
            <span className="text-xs text-gray-500">Baserat på senaste aktivitet</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
            {orgs.map(({ org, daysSinceActive, status }) => (
                <div key={org.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} shadow-sm`}></div>
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{org.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{org.studios.length} skärmar</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                            {daysSinceActive === Infinity ? 'Aldrig' : `${Math.floor(daysSinceActive)} dagar sedan`}
                        </span>
                    </div>
                </div>
            ))}
            {orgs.length === 0 && (
                <p className="p-6 text-center text-gray-500">Inga organisationer att visa.</p>
            )}
        </div>
    </div>
);

const AtRiskWidget: React.FC<{ atRiskOrgs: OrgHealthStatus[] }> = ({ atRiskOrgs }) => {
    if (atRiskOrgs.length === 0) return null;

    return (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
            <h3 className="text-red-800 dark:text-red-200 font-bold mb-4 flex items-center gap-2">
                <span className="text-xl">⚠️</span> At Risk - Agera nu!
            </h3>
            <div className="space-y-3">
                {atRiskOrgs.slice(0, 5).map(({ org, daysSinceActive }) => (
                    <div key={org.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{org.name}</span>
                        <span className="text-xs font-bold text-red-500">
                            {daysSinceActive === Infinity ? 'Ingen aktivitet' : `${Math.floor(daysSinceActive)} dagar inaktiv`}
                        </span>
                    </div>
                ))}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-4 text-center">
                Kontakta dessa kunder för att minska risken för churn.
            </p>
        </div>
    );
};

// --- Main Component ---

export const SystemDashboardContent: React.FC<{ organizations: Organization[] }> = ({ organizations }) => {
    
    const analyticsData = useMemo(() => {
        const now = Date.now();
        const processedOrgs: OrgHealthStatus[] = organizations.map(org => {
            const lastActive = org.lastActiveAt || 0;
            const daysSinceActive = lastActive ? (now - lastActive) / (1000 * 60 * 60 * 24) : Infinity;
            
            let status: OrgHealthStatus['status'] = 'inactive';
            if (daysSinceActive <= 3) status = 'active';
            else if (daysSinceActive <= 14) status = 'warning';

            return { org, daysSinceActive, status };
        });

        // Sort: Inactive first (most critical), then Warning, then Active
        const sortedOrgs = [...processedOrgs].sort((a, b) => {
            // Priority: Inactive (3) > Warning (2) > Active (1)
            const getScore = (s: string) => s === 'inactive' ? 3 : s === 'warning' ? 2 : 1;
            return getScore(b.status) - getScore(a.status);
        });

        const stats: HealthStats = {
            active: processedOrgs.filter(o => o.status === 'active').length,
            warning: processedOrgs.filter(o => o.status === 'warning').length,
            inactive: processedOrgs.filter(o => o.status === 'inactive').length,
        };

        const totalScreens = organizations.reduce((acc, org) => acc + org.studios.length, 0);

        return { sortedOrgs, stats, totalScreens };
    }, [organizations]);

    const { sortedOrgs, stats, totalScreens } = analyticsData;
    const atRiskOrgs = sortedOrgs.filter(o => o.status === 'inactive');

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Totalt Kunder" value={organizations.length} />
                <MetricCard label="Aktiva Skärmar" value={totalScreens} colorClass="text-purple-600 dark:text-purple-400" />
                <MetricCard label="Aktiva (3d)" value={stats.active} colorClass="text-emerald-600 dark:text-emerald-400" />
                <MetricCard label="Churn Risk" value={stats.inactive} colorClass="text-red-600 dark:text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main List */}
                <div className="lg:col-span-2">
                    <HealthList orgs={sortedOrgs} />
                </div>

                {/* Right Sidebar */}
                <div className="space-y-8">
                    <AtRiskWidget atRiskOrgs={atRiskOrgs} />
                    
                    {/* Distribution Chart (Simple Visual) */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-6">Hälsofördelning</h3>
                        <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 w-full mb-4">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.active / organizations.length) * 100}%` }} className="bg-emerald-500 h-full" title="Aktiva" />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.warning / organizations.length) * 100}%` }} className="bg-yellow-500 h-full" title="Varning" />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.inactive / organizations.length) * 100}%` }} className="bg-red-500 h-full" title="Inaktiva" />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Aktiv</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Varning</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Risk</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
