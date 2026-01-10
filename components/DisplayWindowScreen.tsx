import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useStudio } from '../context/StudioContext';
import { DisplayPost, DisplayWindow } from '../types';

interface DisplayWindowScreenProps {
    onBack: () => void;
    window: DisplayWindow | null;
}

const ProgressBar: React.FC<{ duration: number; isPaused: boolean }> = ({ duration, isPaused }) => {
    const animationStyle: React.CSSProperties = {
        animationDuration: `${duration}s`,
        animationPlayState: isPaused ? 'paused' : 'running',
    };

    return (
        <div className="absolute bottom-0 left-0 h-1.5 bg-white/20 w-full">
            <div
                key={duration} // Reset animation when duration changes
                className="h-full bg-white animate-progress-bar"
                style={animationStyle}
            ></div>
            <style>{`
                @keyframes progress-bar-animation {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-progress-bar {
                    animation-name: progress-bar-animation;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
};

export const DisplayWindowScreen: React.FC<DisplayWindowScreenProps> = ({ onBack, window: activeWindow }) => {
    const { selectedStudio } = useStudio();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const wakeLockSentinelRef = useRef<any>(null); // For Screen Wake Lock API
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    const activePosts = useMemo(() => {
        if (!activeWindow?.isEnabled || !selectedStudio || !activeWindow.posts) {
            return [];
        }
        const now = new Date();
        return activeWindow.posts.filter(post => {
            const isStudioMatch = post.visibleInStudios && (post.visibleInStudios.includes('all') || post.visibleInStudios.includes(selectedStudio.id));
            if (!isStudioMatch) return false;

            const hasStartDate = post.startDate && post.startDate.length > 0;
            const hasEndDate = post.endDate && post.endDate.length > 0;

            if (hasStartDate && new Date(post.startDate!) > now) return false; // Not yet active
            if (hasEndDate && new Date(post.endDate!) < now) return false; // Expired

            return true;
        });
    }, [activeWindow, selectedStudio]);
    
    const timerIdRef = useRef<number | null>(null);
    const advanceCallbackRef = useRef<(() => void) | undefined>(undefined);

    // Fullscreen handlers
    const handleEnterFullscreen = async () => {
        if (document.fullscreenEnabled) {
            try {
                await document.documentElement.requestFullscreen();
            } catch (err) {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            }
        }
    };

    const handleExitFullscreen = async () => {
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (err) {
                console.error(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
            }
        }
    };

    // Effect to listen for fullscreen changes (e.g., user pressing ESC)
    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);


    // Keep the ref pointing to the latest advance logic, now with transitions
    useEffect(() => {
        advanceCallbackRef.current = () => {
            if (activePosts.length > 0) {
                 setIsFadingOut(true);
                 // Wait for fade-out to complete before changing content
                 setTimeout(() => {
                     setCurrentIndex(prevIndex => (prevIndex + 1) % activePosts.length);
                     setIsFadingOut(false);
                 }, 500); // This must match the fade-out duration
            }
        };
    }, [activePosts.length]);

    // Screen Wake Lock Logic
    const requestWakeLock = useCallback(async () => {
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await (navigator as any).wakeLock.request('screen');
                wakeLockSentinelRef.current = wakeLock;
                wakeLockSentinelRef.current.addEventListener('release', () => {
                    console.log('Screen Wake Lock was released by the system.');
                    wakeLockSentinelRef.current = null;
                });
                console.log('Screen Wake Lock is active.');
            } catch (err: any) {
                console.error(`Failed to acquire wake lock: ${err.name}, ${err.message}`);
            }
        } else {
            console.warn('Wake Lock API is not supported in this browser.');
        }
    }, []);

    useEffect(() => {
        requestWakeLock();

        const handleVisibilityChange = () => {
            if (wakeLockSentinelRef.current === null && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (wakeLockSentinelRef.current) {
                wakeLockSentinelRef.current.release();
                wakeLockSentinelRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [requestWakeLock]);
    
    // The main timer effect
    useEffect(() => {
        if (timerIdRef.current) {
            clearTimeout(timerIdRef.current);
        }

        if (activePosts.length <= 1) {
            return; // No need for a timer
        }

        const currentPost = activePosts[currentIndex];
        if (!currentPost) return;
        
        // Videos advance via their onEnded event, not the timer.
        if (currentPost.layout === 'video-fullscreen' && currentPost.videoUrl) {
            return;
        }

        const FADE_DURATION = 500; // ms
        // Subtract fade duration so the transition starts before the time is up
        const duration = ((currentPost.durationSeconds || 15) * 1000) - FADE_DURATION;
        
        if (advanceCallbackRef.current && duration > 0) {
            timerIdRef.current = window.setTimeout(advanceCallbackRef.current, duration);
        }

        return () => {
            if (timerIdRef.current) {
                clearTimeout(timerIdRef.current);
            }
        };
    }, [currentIndex, activePosts]);


    if (!activeWindow || !activeWindow.isEnabled) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white text-center p-8">
                <h1 className="text-4xl font-bold">Skyltfönster är inte aktiverat</h1>
                <p className="text-xl text-gray-400 mt-4">Aktivera funktionen i adminpanelen för att visa innehåll.</p>
                <button onClick={onBack} className="mt-8 bg-primary text-white font-bold py-3 px-6 rounded-lg">
                    Gå tillbaka
                </button>
            </div>
        );
    }
    
    if (activePosts.length === 0) {
         return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white text-center p-8">
                <h1 className="text-4xl font-bold">Inget innehåll att visa</h1>
                <p className="text-xl text-gray-400 mt-4">Lägg till bilder, videor eller texter i adminpanelen för att de ska visas här.</p>
                 <button onClick={onBack} className="mt-8 bg-primary text-white font-bold py-3 px-6 rounded-lg">
                    Gå tillbaka
                </button>
            </div>
        );
    }

    const currentPost = activePosts[currentIndex];
    
    if (!currentPost) {
        // This can happen briefly if the list of active posts changes.
        // Reset to the first item to recover.
        if (currentIndex > 0 && activePosts.length > 0) {
            setCurrentIndex(0);
        }
        return null;
    }
    
    const renderContent = (post: DisplayPost) => {
        switch(post.layout) {
            case 'image-fullscreen':
                const overlayClass = post.disableOverlay ? '' : 'bg-black/50';
                return (
                     <div className="w-full h-full relative text-white">
                        {post.imageUrl && <img src={post.imageUrl} alt={post.headline || ''} className="absolute inset-0 w-full h-full object-cover" />}
                        <div className={`absolute inset-0 ${overlayClass} flex flex-col justify-end p-12`}>
                            {post.headline && <h1 className="text-6xl font-black drop-shadow-lg">{post.headline}</h1>}
                            {post.body && <p className="text-2xl mt-4 max-w-3xl drop-shadow-md">{post.body}</p>}
                        </div>
                    </div>
                );
            case 'video-fullscreen':
                 return (
                    <div className="w-full h-full relative">
                        {post.videoUrl && (
                            <video 
                                src={post.videoUrl} 
                                className="absolute inset-0 w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                playsInline 
                                key={post.id} // Re-mount video element for new source
                                onEnded={() => advanceCallbackRef.current && advanceCallbackRef.current()}
                            />
                        )}
                    </div>
                );
            case 'image-left':
                return (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white p-12 gap-12">
                        {post.imageUrl && <img src={post.imageUrl} alt={post.headline || ''} className="w-1/2 h-full object-cover rounded-lg" />}
                        <div className="w-1/2">
                             {post.headline && <h1 className="text-6xl font-black">{post.headline}</h1>}
                             {post.body && <p className="text-2xl mt-4">{post.body}</p>}
                        </div>
                    </div>
                )
            case 'text-only':
            default:
                return (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white text-center p-12">
                         {post.headline && <h1 className="text-7xl font-black">{post.headline}</h1>}
                         {post.body && <p className="text-3xl mt-6 max-w-4xl">{post.body}</p>}
                    </div>
                );
        }
    }

    const buttonClass = "bg-black/50 text-white/70 hover:bg-black hover:text-white rounded-full px-4 py-2 text-sm font-semibold transition-colors";

    return (
        <div className="fixed inset-0 bg-black text-white font-sans overflow-hidden">
            <div
                className={`w-full h-full transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
            >
                {renderContent(currentPost)}
            </div>
            {currentPost.layout !== 'video-fullscreen' && (
                <ProgressBar duration={currentPost.durationSeconds} isPaused={isFadingOut} key={currentIndex} />
            )}
             <div className="absolute top-4 right-4 flex gap-2 z-10">
                {document.fullscreenEnabled && (
                    isFullscreen ? (
                        <button onClick={handleExitFullscreen} className={buttonClass}>Avsluta helskärm</button>
                    ) : (
                        <button onClick={handleEnterFullscreen} className={buttonClass}>Gå till helskärm</button>
                    )
                )}
                <button
                    onClick={onBack}
                    className={buttonClass}
                >
                    Stäng
                </button>
            </div>
        </div>
    );
};