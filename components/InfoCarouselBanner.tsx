import React, { useState, useEffect } from 'react';
import { InfoMessage } from '../types';

interface InfoCarouselBannerProps {
    messages: InfoMessage[];
    className?: string;
    forceDark?: boolean;
}

const getAnimationClass = (animation: InfoMessage['animation']) => {
    switch (animation) {
        case 'slide-left':
            return 'animate-slide-in-left';
        case 'slide-right':
            return 'animate-slide-in-right';
        case 'fade':
        default:
            return 'animate-fade-in-banner';
    }
};

export const InfoCarouselBanner: React.FC<InfoCarouselBannerProps> = ({ messages, className = '', forceDark = false }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        // Reset to first message if the list of active messages changes
        setCurrentIndex(0);
    }, [messages]);

    useEffect(() => {
        if (messages.length <= 1) return;

        // SÄKERHETSSPÄRR (Förhindrar krascher)
        const safeIndex = currentIndex >= messages.length ? 0 : currentIndex;
        const currentMessage = messages[safeIndex];
        if (!currentMessage) return;

        const duration = (currentMessage.durationSeconds || 10) * 1000;

        const timer = setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
                setIsFading(false);
            }, 500); 
        }, duration - 500); 

        return () => clearTimeout(timer);
    }, [currentIndex, messages]);

    if (messages.length === 0) {
        return null;
    }

    const safeIndex = currentIndex >= messages.length ? 0 : currentIndex;
    const currentMessage = messages[safeIndex];
    if (!currentMessage) return null;

    const layout = currentMessage.layout || 'text-only';
    const hasImage = layout !== 'text-only' && currentMessage.imageUrl;

    const bgClass = forceDark 
        ? 'bg-black/90' 
        : 'bg-white/90 dark:bg-black/90';
    
    const textClass = forceDark 
        ? 'text-white' 
        : 'text-gray-900 dark:text-white';
    
    const secondaryTextClass = forceDark
        ? 'text-gray-300'
        : 'text-gray-600 dark:text-gray-300';
    
    const borderClass = forceDark
        ? 'border-gray-800'
        : 'border-gray-200 dark:border-gray-700/50';

    return (
        // DOLD PÅ MOBIL (hidden md:flex), INGET "FIXED" (fyller sin behållare snyggt)
        <div className={`hidden md:flex w-full h-full ${bgClass} backdrop-blur-md ${textClass} z-[1001] border-t ${borderClass} items-center justify-center p-4 sm:p-6 lg:p-8 portrait:!p-2.5 sm:portrait:!p-3.5 ${className}`}>
             <div
                key={safeIndex} 
                className={`w-full max-w-6xl mx-auto px-4 transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'} ${getAnimationClass(currentMessage.animation)}`}
            >
                {/* STORT AVSTÅND: gap-12 på tv, mindre på tablet */}
                <div className={`flex items-center h-full gap-4 sm:gap-6 lg:gap-12 portrait:!gap-3 sm:portrait:!gap-4 ${layout === 'image-right' ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                    {hasImage && (
                        <img 
                            src={currentMessage.imageUrl} 
                            alt={currentMessage.headline} 
                            // Responsiv bildstorlek baserad på behållarhöjd
                            className="h-[85%] aspect-square max-h-[384px] max-w-[384px] portrait:!h-[105px] portrait:!w-[105px] sm:portrait:!h-[145px] sm:portrait:!w-[145px] object-cover rounded-2xl flex-shrink-0 shadow-xl"
                        />
                    )}
                    <div className={`flex-grow min-w-0 ${layout === 'image-right' ? 'text-right' : 'text-left'}`}>
                        {/* STOR RUBRIK: text-4xl på stor TV, mindre på tablet */}
                        <h4 className="font-bold text-lg sm:text-xl lg:text-3xl xl:text-4xl text-primary line-clamp-2 mb-2 lg:mb-4 portrait:!text-sm sm:portrait:!text-xl portrait:!mb-1 leading-tight">{currentMessage.headline}</h4>
                        {/* STOR TEXT: text-xl på stor TV, mindre på tablet */}
                        <p className={`text-xs sm:text-sm lg:text-base xl:text-xl ${secondaryTextClass} line-clamp-4 md:line-clamp-6 lg:line-clamp-8 xl:line-clamp-12 portrait:line-clamp-3 sm:portrait:!text-base sm:portrait:line-clamp-4 whitespace-pre-wrap leading-relaxed`}>{currentMessage.body}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};