
import React, { useMemo, useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import { ThemeOption, Page, SeasonalThemeSetting, ThemeDateRange } from '../../types';
import { getSeasonalThemes, listenToCommunityLogs } from '../../services/firebaseService';

// Helper to get week number
const getISOWeek = (date: Date): number => {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Determine if a range is active
const isRangeActive = (range: ThemeDateRange, now: Date): boolean => {
    if (range.useWeekNumber && range.weekNumber !== undefined) {
        return getISOWeek(now) === range.weekNumber;
    }

    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    const start = range.startMonth * 100 + range.startDay;
    const end = range.endMonth * 100 + range.endDay;
    const current = currentMonth * 100 + currentDay;

    if (start <= end) {
        return current >= start && current <= end;
    } else {
        // Crosses year boundary (e.g., Dec 1 - Jan 31)
        return current >= start || current <= end;
    }
};

// Determine the active theme based on config and system settings
export const useActiveTheme = (): ThemeOption => {
    const { studioConfig } = useStudio();
    const [systemThemes, setSystemThemes] = useState<SeasonalThemeSetting[]>([]);
    
    useEffect(() => {
        getSeasonalThemes().then(setSystemThemes);
    }, []);

    const configTheme = studioConfig.seasonalTheme || 'none';

    // If explicit theme is chosen, use it
    if (configTheme !== 'auto' && configTheme !== 'none') {
        return configTheme;
    }

    // If 'auto' or 'none' (defaulting to none if disabled), calculate based on date
    if (configTheme === 'none' || systemThemes.length === 0) {
        return 'none';
    }

    const now = new Date();
    
    // Priority List for Automatic Selection:
    // 1. New Year (Highest)
    // 2. Christmas
    // 3. Halloween Week
    // 4. Valentines
    // 5. Easter
    // 6. Midsummer
    // 7. Winter (The long winter stretch)
    // 8. Summer (The long summer stretch)
    
    const priorityOrder: ThemeOption[] = [
        'newyear', 
        'christmas', 
        'halloween', 
        'valentines', 
        'easter', 
        'midsummer', 
        'winter', 
        'summer'
    ];

    for (const themeId of priorityOrder) {
        const themeSetting = systemThemes.find(t => t.id === themeId);
        if (themeSetting && themeSetting.isEnabled) {
            if (themeSetting.ranges.some(r => isRangeActive(r, now))) {
                return themeId;
            }
        }
    }

    return 'none';
};

// --- Particles Components ---

const SnowParticles = () => {
    const particles = useMemo(() => Array.from({ length: 100 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100 + '%',
        animationDuration: 5 + Math.random() * 15 + 's',
        animationDelay: Math.random() * -20 + 's',
        size: 2 + Math.random() * 4 + 'px',
        opacity: 0.3 + Math.random() * 0.5
    })), []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[2000] overflow-hidden">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="snowflake"
                    style={{
                        left: p.left,
                        width: p.size,
                        height: p.size,
                        animationDuration: p.animationDuration,
                        animationDelay: p.animationDelay,
                        opacity: p.opacity
                    }}
                />
            ))}
        </div>
    );
};

const FogEffect = () => (
    <div className="fixed bottom-0 left-0 right-0 h-64 pointer-events-none z-[2000] opacity-60">
        <div className="fog-layer"></div>
    </div>
);

const FloatingHearts = () => {
    const particles = useMemo(() => Array.from({ length: 15 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100 + '%',
        animationDuration: 6 + Math.random() * 4 + 's',
        animationDelay: Math.random() * 5 + 's',
        size: 20 + Math.random() * 30 + 'px',
    })), []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[2000] overflow-hidden">
            {particles.map(p => (
                <div key={p.id} className="heart-piece" style={{
                    left: p.left,
                    animationDuration: p.animationDuration,
                    animationDelay: p.animationDelay,
                    fontSize: p.size
                }}>♥</div>
            ))}
        </div>
    );
};

const ConfettiRain = () => {
    const particles = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100 + '%',
        animationDuration: 4 + Math.random() * 4 + 's',
        animationDelay: Math.random() * 2 + 's',
        backgroundColor: ['#FFD700', '#C0C0C0', '#ffffff'][Math.floor(Math.random() * 3)]
    })), []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[2000] overflow-hidden">
            {particles.map(p => (
                <div key={p.id} className="confetti-piece" style={{
                    left: p.left,
                    animationDuration: p.animationDuration,
                    animationDelay: p.animationDelay,
                    backgroundColor: p.backgroundColor
                }}></div>
            ))}
        </div>
    );
};

const SummerSun = () => (
    <div className="fixed top-[-100px] right-[-100px] w-[300px] h-[300px] bg-yellow-400/20 rounded-full blur-[80px] pointer-events-none z-[2000]"></div>
);

// --- Mascot Components ---

const ChristmasMascot = ({ page }: { page: Page }) => {
    if (page !== Page.Home) return null;

    return (
        <div className="fixed top-20 left-[60%] -translate-x-1/2 z-[2000] pointer-events-none hidden lg:block">
            <img 
                src="/santa-peeking.png" 
                alt="Tomten kikar fram" 
                className="w-60 xl:w-80 h-auto object-contain drop-shadow-2xl"
            />
        </div>
    );
};

// Winter Mascot (Snowman) removed as requested

const EasterMascot = () => (
    <div className="fixed bottom-0 left-4 w-32 h-32 pointer-events-none z-[2000]">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
            {/* Paws on edge */}
            <ellipse cx="30" cy="100" rx="8" ry="5" fill="white" />
            <ellipse cx="70" cy="100" rx="8" ry="5" fill="white" />
            {/* Head */}
            <path d="M25,100 Q25,60 50,60 Q75,60 75,100" fill="white" />
            {/* Ears */}
            <path d="M30,70 Q25,20 40,20 Q50,20 45,70" fill="white" />
            <path d="M35,65 Q30,30 40,30 Q45,30 42,65" fill="#fbcfe8" />
            <path d="M70,70 Q75,20 60,20 Q50,20 55,70" fill="white" />
            <path d="M65,65 Q70,30 60,30 Q55,30 58,65" fill="#fbcfe8" />
            {/* Face */}
            <circle cx="40" cy="80" r="2" fill="#1f2937" />
            <circle cx="60" cy="80" r="2" fill="#1f2937" />
            <path d="M45,85 Q50,90 55,85" stroke="#1f2937" strokeWidth="1" fill="none" />
        </svg>
    </div>
);

const HalloweenMascot = () => (
    <div className="fixed bottom-4 left-4 w-32 h-40 pointer-events-none z-[2000] animate-pulse">
        <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-2xl">
            <path d="M50,10 Q10,10 10,60 L10,110 L25,100 L40,110 L55,100 L70,110 L85,100 L90,110 L90,60 Q90,10 50,10 Z" fill="white" opacity="0.9" />
            <circle cx="35" cy="40" r="5" fill="#1f2937" />
            <circle cx="65" cy="40" r="5" fill="#1f2937" />
            <ellipse cx="50" cy="55" rx="8" ry="12" fill="#1f2937" />
        </svg>
    </div>
);

const GymThermometerMascot = ({ isStudioMode = false }: { isStudioMode?: boolean }) => {
    const { selectedOrganization } = useStudio();
    const [stats, setStats] = useState({
        avgPoints: 0,
        activeUsersCount: 0,
        totalPoints: 0,
        status: 'kallt' as 'kallt' | 'ljummet' | 'varmt' | 'hett'
    });

    useEffect(() => {
        if (!selectedOrganization?.id) return;
        
        // Prenumerera på träningspass i realtid
        const unsubscribe = listenToCommunityLogs(selectedOrganization.id, (logs) => {
            // Hämta måndagen i den aktuella veckan
            const now = new Date();
            const startOfWeek = new Date(now);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            const thisWeeksLogs = logs.filter(log => {
                const d = new Date(log.date).getTime();
                return d >= startOfWeek.getTime();
            });

            const userPointsMap: Record<string, number> = {};
            thisWeeksLogs.forEach(log => {
                const uid = log.memberId;
                if (!uid) return;
                
                let pts = log.summerPoints;
                if (pts === undefined) {
                    const isOfficialTemplate = log.workoutId && log.workoutId !== 'manual' && !log.workoutId.startsWith('custom_') && !log.workoutId.startsWith('custom-');
                    if (isOfficialTemplate) {
                        pts = 3;
                    } else if (log.inStudio === true) {
                        pts = 2;
                    } else {
                        pts = 1;
                    }
                }
                userPointsMap[uid] = (userPointsMap[uid] || 0) + pts;
            });

            const activeUsers = Object.keys(userPointsMap);
            const activeUsersCount = activeUsers.length;
            let totalPoints = 0;
            activeUsers.forEach(uid => {
                totalPoints += userPointsMap[uid];
            });

            const avgPoints = activeUsersCount > 0 ? Number((totalPoints / activeUsersCount).toFixed(1)) : 0;

            let status: 'kallt' | 'ljummet' | 'varmt' | 'hett' = 'kallt';
            if (avgPoints >= 6.5) {
                status = 'hett';
            } else if (avgPoints >= 4.5) {
                status = 'varmt';
            } else if (avgPoints >= 2.5) {
                status = 'ljummet';
            }

            setStats({
                avgPoints,
                activeUsersCount,
                totalPoints,
                status
            });
        });

        return () => unsubscribe();
    }, [selectedOrganization?.id]);

    const getStatusConfig = () => {
        switch (stats.status) {
            case 'hett':
                return {
                    bg: 'bg-red-500',
                    text: 'text-red-500',
                    glow: 'shadow-red-500/50',
                    heightClass: 'h-[95%]',
                    label: 'HET 🌋',
                    desc: 'Gymmet kokar! Det är sjuuukt bra tryck!'
                };
            case 'varmt':
                return {
                    bg: 'bg-orange-500',
                    text: 'text-orange-500',
                    glow: 'shadow-orange-500/50',
                    heightClass: 'h-[75%]',
                    label: 'VARMT 🔥',
                    desc: 'Härligt tempo – nu svettas vi ihop!'
                };
            case 'ljummet':
                return {
                    bg: 'bg-yellow-500',
                    text: 'text-yellow-500',
                    glow: 'shadow-yellow-500/50',
                    heightClass: 'h-[50%]',
                    label: 'LJUMMET 🌤️',
                    desc: 'Stabil fart i gymmet!'
                };
            case 'kallt':
            default:
                return {
                    bg: 'bg-blue-500',
                    text: 'text-blue-500',
                    glow: 'shadow-blue-500/50',
                    heightClass: 'h-[25%]',
                    label: 'SVALT ❄️',
                    desc: 'Kom igen gänget, dags att öka!'
                };
        }
    };

    const config = getStatusConfig();

    if (isStudioMode) {
        return (
            <div className="fixed bottom-10 left-10 z-[2000] flex flex-col items-center pointer-events-none select-none animate-fade-in">
                {/* Clean, stand-alone high-contrast thermometer */}
                <div className="relative w-8 h-48 bg-slate-950/20 backdrop-blur-sm rounded-full border border-white/20 p-[3px] flex flex-col justify-end overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]">
                    <div className={`w-full rounded-full transition-all duration-1000 ease-out ${config.bg} shadow-[0_0_15px_rgba(255,255,255,0.2)]`} style={{ height: config.heightClass }}></div>
                </div>
                {/* Thermometer bulb at the bottom */}
                <div className={`w-14 h-14 rounded-full border border-white/20 mt-[-6px] flex items-center justify-center transition-all duration-1000 ${config.bg} ${config.glow} shadow-[0_0_25px_rgba(0,0,0,0.8)]`}>
                    <div className="w-4 h-4 bg-white/30 rounded-full"></div>
                </div>
                {/* Ultra-clean badge showing points */}
                <span className="text-[10px] font-black tracking-wider text-white mt-3 px-2.5 py-1 bg-slate-950/80 backdrop-blur border border-white/10 rounded-full uppercase shadow-md">
                    {stats.avgPoints} POÄNG
                </span>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 z-[2000] p-5 w-80 bg-gray-950/95 border border-white/10 rounded-[2.2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] flex items-center gap-5 text-white animate-fade-in">
            {/* Vänster kolumn: Termometergrafik */}
            <div className="flex flex-col items-center flex-shrink-0 w-8">
                {/* Rör */}
                <div className="relative w-4 h-32 bg-gray-800 rounded-full border border-gray-700/50 p-[2px] flex flex-col justify-end overflow-hidden">
                    <div className={`w-full rounded-full transition-all duration-1000 ease-out ${config.bg}`} style={{ height: config.heightClass }}></div>
                </div>
                {/* Kula */}
                <div className={`w-8 h-8 rounded-full border border-gray-700/50 mt-[-4px] flex items-center justify-center transition-all ${config.bg} ${config.glow} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                    <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                </div>
            </div>

            {/* Höger kolumn: Text och värden */}
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black tracking-widest text-[#fbbf24] uppercase">Sommar-Sisu ☀️</span>
                </div>
                <h4 className={`text-2xl font-black tracking-tight leading-none mb-1 ${config.text}`}>
                    {config.label}
                </h4>
                <p className="text-[11px] text-gray-400 font-medium mb-3 leading-tight">
                    {config.desc}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-left">
                    <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Veckosnitt</p>
                        <p className="text-sm font-extrabold tracking-tight text-white">{stats.avgPoints} poäng</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Aktiva</p>
                        <p className="text-sm font-extrabold tracking-tight text-white">{stats.activeUsersCount}st</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ValentinesMascot = () => (
    <div className="fixed bottom-0 left-4 w-32 h-32 pointer-events-none z-[2000]">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl animate-pulse">
            <path d="M50,30 Q70,5 90,30 Q100,60 50,90 Q0,60 10,30 Q30,5 50,30 Z" fill="#f43f5e" />
            <path d="M30,40 Q35,35 40,40" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M60,40 Q65,35 70,40" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M40,60 Q50,70 60,60" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
    </div>
);

// --- Main Overlay Component ---

interface SeasonalOverlayProps {
    page: Page;
    isStudioMode?: boolean;
    isAdminView?: boolean;
}

export const SeasonalOverlay: React.FC<SeasonalOverlayProps> = ({ page, isStudioMode = false, isAdminView = false }) => {
    const theme = useActiveTheme();

    if (isAdminView) return null;

    if (theme === 'none') return null;

    return (
        <>
            {/* 1. Background Particles */}
            {(theme === 'winter' || theme === 'christmas') && <SnowParticles />}
            {theme === 'halloween' && <FogEffect />}
            {theme === 'valentines' && <FloatingHearts />}
            {theme === 'newyear' && <ConfettiRain />}
            {(theme === 'summer' || theme === 'midsummer') && <SummerSun />}
            
            {/* 2. Corner Mascots */}
            {theme === 'christmas' && <ChristmasMascot page={page} />}
            {theme === 'easter' && <EasterMascot />}
            {theme === 'halloween' && <HalloweenMascot />}
            {(theme === 'summer' || theme === 'midsummer') && <GymThermometerMascot isStudioMode={isStudioMode} />}
            {theme === 'valentines' && <ValentinesMascot />}

            {/* 3. Screen Vignettes/Tints */}
            {(theme === 'winter' || theme === 'christmas') && (
                <div className="fixed inset-0 pointer-events-none z-[1999] shadow-[inset_0_0_100px_rgba(200,230,255,0.2)]"></div>
            )}
            {theme === 'halloween' && (
                <div className="fixed inset-0 pointer-events-none z-[1999] shadow-[inset_0_-50px_150px_rgba(0,0,0,0.6)] bg-purple-900/5 mix-blend-overlay"></div>
            )}
        </>
    );
};

export const SeasonalLogoTopper: React.FC = () => null;
