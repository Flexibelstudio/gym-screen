
import React, { useMemo, useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import { ThemeOption, Page, SeasonalThemeSetting, ThemeDateRange } from '../../types';
import { getSeasonalThemes } from '../../services/firebaseService';

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
    <div className="fixed bottom-0 right-4 w-32 h-32 pointer-events-none z-[2000]">
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
    <div className="fixed bottom-4 right-4 w-32 h-40 pointer-events-none z-[2000] animate-pulse">
        <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-2xl">
            <path d="M50,10 Q10,10 10,60 L10,110 L25,100 L40,110 L55,100 L70,110 L85,100 L90,110 L90,60 Q90,10 50,10 Z" fill="white" opacity="0.9" />
            <circle cx="35" cy="40" r="5" fill="#1f2937" />
            <circle cx="65" cy="40" r="5" fill="#1f2937" />
            <ellipse cx="50" cy="55" rx="8" ry="12" fill="#1f2937" />
        </svg>
    </div>
);

const SummerMascot = () => (
    <div className="fixed bottom-0 right-4 w-40 h-40 pointer-events-none z-[2000]">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl">
            {/* Sun Body */}
            <circle cx="150" cy="150" r="40" fill="#fbbf24" />
            {/* Rays */}
            <g stroke="#fbbf24" strokeWidth="8" strokeLinecap="round">
                <line x1="150" y1="90" x2="150" y2="70" />
                <line x1="90" y1="150" x2="70" y2="150" />
                <line x1="110" y1="110" x2="95" y2="95" />
            </g>
            {/* Sunglasses */}
            <path d="M125,145 L175,145 L175,155 Q175,165 165,165 L160,165 Q150,165 150,155 L150,150 L145,150 L145,155 Q145,165 135,165 L130,165 Q120,165 120,155 Z" fill="#1f2937" />
            <line x1="120" y1="148" x2="110" y2="140" stroke="#1f2937" strokeWidth="2" />
            {/* Smile */}
            <path d="M135,175 Q150,185 165,175" stroke="#b45309" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
    </div>
);

const ValentinesMascot = () => (
    <div className="fixed bottom-0 right-4 w-32 h-32 pointer-events-none z-[2000]">
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
}

export const SeasonalOverlay: React.FC<SeasonalOverlayProps> = ({ page }) => {
    const theme = useActiveTheme();

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
            {(theme === 'summer' || theme === 'midsummer') && <SummerMascot />}
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
