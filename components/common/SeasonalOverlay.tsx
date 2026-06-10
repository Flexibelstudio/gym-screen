
import React, { useMemo, useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import { useAuth } from '../../context/AuthContext';
import { ThemeOption, Page, SeasonalThemeSetting, ThemeDateRange } from '../../types';
import { getSeasonalThemes, listenToCommunityLogs, listenToLeaderboardLogs } from '../../services/firebaseService';

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
    const { selectedOrganization, selectedStudio } = useStudio();
    const { userData } = useAuth();
    const [stats, setStats] = useState({
        avgPoints: 0,
        activeUsersCount: 0,
        totalPoints: 0,
        status: 'kallt' as 'kallt' | 'ljummet' | 'varmt' | 'hett'
    });

    useEffect(() => {
        if (!selectedOrganization?.id) return;
        
        // Prenumerera på träningspass i realtid (hämtar tillräckligt antal loggar för hela org, filtrerar sedan på ort)
        const unsubscribe = listenToLeaderboardLogs(selectedOrganization.id, 1000, (logs) => {
            // Hämta måndagen i den aktuella veckan
            const now = new Date();
            const startOfWeek = new Date(now);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            let thisWeeksLogs = logs.filter(log => {
                const d = new Date(log.date).getTime();
                return d >= startOfWeek.getTime();
            });

            // Filtrera efter ort/studio om det finns på skärmen eller användaren
            const activeLocationId = isStudioMode ? selectedStudio?.locationId : userData?.locationId;
            if (activeLocationId) {
                thisWeeksLogs = thisWeeksLogs.filter(log => log.locationId === activeLocationId);
            }

            const userPointsMap: Record<string, number> = {};
            thisWeeksLogs.forEach(log => {
                const uid = log.memberId;
                if (!uid) return;
                
                let pts = 0;
                if (log.inStudio === true) {
                    pts = 2;
                } else {
                    const isLessThan30 = log.durationMinutes !== undefined && log.durationMinutes > 0 && log.durationMinutes < 30;
                    if (!isLessThan30) {
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
    }, [selectedOrganization?.id, selectedStudio?.locationId, userData?.locationId, isStudioMode]);

    const getStatusConfig = () => {
        switch (stats.status) {
            case 'hett':
                return {
                    color: '#ef4444',
                    percentage: 0.90,
                    label: 'HET 🌋',
                };
            case 'varmt':
                return {
                    color: '#f97316',
                    percentage: 0.65,
                    label: 'VARMT 🔥',
                };
            case 'ljummet':
                return {
                    color: '#eab308',
                    percentage: 0.45,
                    label: 'LJUMMET 🌤️',
                };
            case 'kallt':
            default:
                return {
                    color: '#3b82f6',
                    percentage: 0.20,
                    label: 'SVALT ❄️',
                };
        }
    };

    const config = getStatusConfig();
    const percentage = config.percentage;
    const color = config.color;

    // Fluid level Y coordinates (startY = 152 to endY = 14)
    const startY = 152;
    const endY = 14;
    const currentY = startY - (percentage * (startY - endY));

    if (isStudioMode) {
        return (
            <div className="fixed bottom-10 left-10 z-[2000] flex flex-col items-center pointer-events-none select-none animate-fade-in origin-bottom rotate-[5deg] drop-shadow-[0_3px_6px_rgba(0,0,0,0.3)]">
                {/* Unified continuous Glass Thermometer SVG */}
                <svg 
                    viewBox="0 0 40 160" 
                    className="w-16 h-52 overflow-visible drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                >
                    <defs>
                        {/* Soft glow matching the liquid color */}
                        <filter id={`glow-large-${color.replace('#', '')}`} x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <linearGradient id={`liquid-grad-large-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={color} />
                            <stop offset="100%" stopColor={color === '#ef4444' ? '#991b1b' : color === '#f97316' ? '#c2410c' : color === '#eab308' ? '#a16207' : '#1e40af'} />
                        </linearGradient>
                        <clipPath id="glass-inner-large">
                            <path d="M 12,14 L 12,112 A 22,22 0 1,0 28,112 L 28,14 A 8,8 0 0,0 12,14 Z" />
                        </clipPath>
                    </defs>

                    {/* Glowing backlight to make the mercury look bright & active */}
                    <path 
                        d="M 12,14 L 12,112 A 22,22 0 1,0 28,112 L 28,14 A 8,8 0 0,0 12,14 Z"
                        fill={color}
                        opacity="0.25"
                        filter={`url(#glow-large-${color.replace('#', '')})`}
                    />

                    {/* Unified Glass Tube Outline (Sleek container structure) with warm white solid semi-transbg for high contrast */}
                    <path 
                        d="M 10,12 L 10,110 A 24,24 0 1,0 30,110 L 30,12 A 10,10 0 0,0 10,12 Z" 
                        fill="rgba(254, 243, 199, 0.94)"
                        stroke="rgba(0, 0, 0, 0.35)"
                        strokeWidth="1.5"
                    />

                    {/* Rising Liquid */}
                    <g clipPath="url(#glass-inner-large)">
                        <rect 
                            x="-10" 
                            y={currentY} 
                            width="60" 
                            height={160 - currentY} 
                            fill={`url(#liquid-grad-large-${color.replace('#', '')})`} 
                            className="transition-all duration-1000 ease-out"
                        />
                        {/* High-quality highlight glare */}
                        <rect x="18" y="10" width="1" height="130" fill="white" opacity="0.15" />
                    </g>

                    {/* Highlight glare on left side of glass */}
                    <path 
                        d="M 12.5,15 L 12.5,110" 
                        stroke="white" 
                        strokeWidth="1.2" 
                        strokeLinecap="round"
                        opacity="0.5" 
                    />

                    {/* Thermometer scale markers (Tick marks) - Dark color to contrast beautifully with white background */}
                    <g stroke="rgba(15, 23, 42, 0.75)" strokeWidth="0.9" opacity="0.8" strokeLinecap="round">
                        <line x1="10" y1="35" x2="13" y2="35" />
                        <line x1="10" y1="55" x2="13" y2="55" />
                        <line x1="10" y1="75" x2="13" y2="75" />
                        <line x1="10" y1="95" x2="13" y2="95" />
                        <line x1="10" y1="115" x2="13" y2="115" />
                        
                        <line x1="30" y1="35" x2="27" y2="35" />
                        <line x1="30" y1="55" x2="27" y2="55" />
                        <line x1="30" y1="75" x2="27" y2="75" />
                        <line x1="30" y1="95" x2="27" y2="95" />
                        <line x1="30" y1="115" x2="27" y2="115" />
                    </g>

                    {/* Dynamisk poängtext inuti den runda bulben */}
                    <text
                        x="20"
                        y="139.5"
                        textAnchor="middle"
                        fill="white"
                        fontSize="15.5"
                        fontWeight="950"
                        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        className="select-none font-black tracking-tighter"
                    >
                        {stats.avgPoints}
                    </text>
                </svg>
            </div>
        );
    }

    // if !isStudioMode (member app view), render same clean thermometer, but smaller
    return (
        <div className="fixed bottom-3 left-3 z-[90] flex flex-col items-center pointer-events-none select-none animate-fade-in origin-bottom rotate-[5deg] drop-shadow-[0_2px_5px_rgba(0,0,0,0.25)]">
            {/* Unified continuous Glass Thermometer SVG - Small */}
            <svg 
                viewBox="0 0 40 160" 
                className="w-12 h-36 overflow-visible drop-shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
            >
                <defs>
                    <filter id={`glow-small-${color.replace('#', '')}`} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <linearGradient id={`liquid-grad-small-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor={color === '#ef4444' ? '#991b1b' : color === '#f97316' ? '#c2410c' : color === '#eab308' ? '#a16207' : '#1e40af'} />
                    </linearGradient>
                    <clipPath id="glass-inner-small">
                        <path d="M 12,14 L 12,112 A 22,22 0 1,0 28,112 L 28,14 A 8,8 0 0,0 12,14 Z" />
                    </clipPath>
                </defs>

                {/* Glowing backlight */}
                <path 
                    d="M 12,14 L 12,112 A 22,22 0 1,0 28,112 L 28,14 A 8,8 0 0,0 12,14 Z"
                    fill={color}
                    opacity="0.2"
                    filter={`url(#glow-small-${color.replace('#', '')})`}
                />

                {/* Unified Glass Tube Outline with warm-white glass background */}
                <path 
                    d="M 10,12 L 10,110 A 24,24 0 1,0 30,110 L 30,12 A 10,10 0 0,0 10,12 Z" 
                    fill="rgba(254, 243, 199, 0.94)"
                    stroke="rgba(0, 0, 0, 0.35)"
                    strokeWidth="1.5"
                />

                {/* Rising Liquid */}
                <g clipPath="url(#glass-inner-small)">
                    <rect 
                        x="-10" 
                        y={currentY} 
                        width="60" 
                        height={160 - currentY} 
                        fill={`url(#liquid-grad-small-${color.replace('#', '')})`} 
                        className="transition-all duration-1000 ease-out"
                    />
                    <rect x="18" y="10" width="1" height="130" fill="white" opacity="0.1" />
                </g>

                {/* Glass sheen highlight */}
                <path 
                    d="M 12.5,15 L 12.5,110" 
                    stroke="white" 
                    strokeWidth="1.2" 
                    strokeLinecap="round"
                    opacity="0.4" 
                />

                {/* Aesthetic measurement ticks - Dark color to contrast with white background */}
                <g stroke="rgba(15, 23, 42, 0.75)" strokeWidth="0.9" opacity="0.8" strokeLinecap="round">
                    <line x1="10" y1="40" x2="13" y2="40" />
                    <line x1="10" y1="65" x2="13" y2="65" />
                    <line x1="10" y1="90" x2="13" y2="90" />
                    <line x1="10" y1="115" x2="13" y2="115" />
                    
                    <line x1="30" y1="40" x2="27" y2="40" />
                    <line x1="30" y1="65" x2="27" y2="65" />
                    <line x1="30" y1="90" x2="27" y2="90" />
                    <line x1="30" y1="115" x2="27" y2="115" />
                </g>

                {/* Dynamisk poängtext inuti den runda bulben */}
                <text
                    x="20"
                    y="139.5"
                    textAnchor="middle"
                    fill="white"
                    fontSize="15.5"
                    fontWeight="950"
                    fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    className="select-none font-black tracking-tighter"
                >
                    {stats.avgPoints}
                </text>
            </svg>
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
    const { studioConfig, selectedOrganization } = useStudio();
    const theme = useActiveTheme();

    if (isAdminView) return null;

    const isChallengeActive = !!studioConfig?.enableSummerChallenge || !!selectedOrganization?.globalConfig?.enableSummerChallenge;

    // Om en utmaning pågår (t.ex. Sommar-Sisu), ska säsongstemat pausas och döljas för att prioritera träningstermometern
    const activeTheme = isChallengeActive ? 'none' : theme;

    if (activeTheme === 'none' && !isChallengeActive) return null;

    return (
        <>
            {/* 1. Background Particles */}
            {activeTheme !== 'none' && (activeTheme === 'winter' || activeTheme === 'christmas') && <SnowParticles />}
            {activeTheme === 'halloween' && <FogEffect />}
            {activeTheme === 'valentines' && <FloatingHearts />}
            {activeTheme === 'newyear' && <ConfettiRain />}
            {activeTheme !== 'none' && (activeTheme === 'summer' || activeTheme === 'midsummer') && <SummerSun />}
            
            {/* 2. Corner Mascots */}
            {activeTheme === 'christmas' && <ChristmasMascot page={page} />}
            {activeTheme === 'easter' && <EasterMascot />}
            {activeTheme === 'halloween' && <HalloweenMascot />}
            {isChallengeActive && <GymThermometerMascot isStudioMode={isStudioMode} />}
            {activeTheme === 'valentines' && <ValentinesMascot />}

            {/* 3. Screen Vignettes/Tints */}
            {(activeTheme === 'winter' || activeTheme === 'christmas') && (
                <div className="fixed inset-0 pointer-events-none z-[1999] shadow-[inset_0_0_100px_rgba(200,230,255,0.2)]"></div>
            )}
            {activeTheme === 'halloween' && (
                <div className="fixed inset-0 pointer-events-none z-[1999] shadow-[inset_0_-50px_150px_rgba(0,0,0,0.6)] bg-purple-900/5 mix-blend-overlay"></div>
            )}
        </>
    );
};

export const SeasonalLogoTopper: React.FC = () => null;
