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
        <div className={`hidden md:flex w-full h-full ${bgClass} backdrop-blur-md ${textClass} z-[1001] border-t ${borderClass} items-center justify-center p-8 ${className}`}>
             <div
                key={safeIndex} 
                className={`w-full max-w-6xl mx-auto px-4 transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'} ${getAnimationClass(currentMessage.animation)}`}
            >
                {/* STORT AVSTÅND: gap-12 */}
                <div className={`flex items-center h-full gap-12 ${layout === 'image-right' ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                    {hasImage && (
                        <img 
                            src={currentMessage.imageUrl} 
                            alt={currentMessage.headline} 
                            // MAFFIG BILD: w-96 h-96
                            className="w-96 h-96 object-cover rounded-2xl flex-shrink-0 shadow-xl"
                        />
                    )}
                    <div className={`flex-grow min-w-0 ${layout === 'image-right' ? 'text-right' : 'text-left'}`}>
                        {/* STOR RUBRIK: text-4xl */}
                        <h4 className="font-bold text-4xl text-primary line-clamp-2 mb-4 leading-tight">{currentMessage.headline}</h4>
                        {/* STOR TEXT: text-xl */}
                        <p className={`text-xl ${secondaryTextClass} line-clamp-12 whitespace-pre-wrap leading-relaxed`}>{currentMessage.body}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};