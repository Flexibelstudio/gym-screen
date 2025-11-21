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

        const currentMessage = messages[currentIndex];
        // Ensure duration is a positive number
        const duration = (currentMessage.durationSeconds || 10) * 1000;

        const timer = setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
                setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
                setIsFading(false);
            }, 500); // Fade-out duration must match CSS transition
        }, duration - 500); // Switch 500ms before end to allow for fade

        return () => clearTimeout(timer);
    }, [currentIndex, messages]);

    if (messages.length === 0) {
        return null;
    }

    const currentMessage = messages[currentIndex];

    const layout = currentMessage.layout || 'text-only';
    const hasImage = layout !== 'text-only' && currentMessage.imageUrl;

    // Determine background and text colors based on forceDark prop or system theme
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
        <div className={`fixed left-0 right-0 h-[512px] ${bgClass} backdrop-blur-md ${textClass} z-[1001] border-t ${borderClass} flex items-center justify-center p-8 ${className}`}>
             <div
                key={currentIndex} // This key is crucial to re-trigger the animation
                className={`w-full max-w-6xl mx-auto px-4 transition-opacity duration-500 ${isFading ? 'opacity-0' : 'opacity-100'} ${getAnimationClass(currentMessage.animation)}`}
            >
                <div className={`flex items-center h-full gap-12 ${layout === 'image-right' ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                    {hasImage && (
                        <img 
                            src={currentMessage.imageUrl} 
                            alt={currentMessage.headline} 
                            className="w-96 h-96 object-cover rounded-2xl flex-shrink-0 shadow-xl"
                        />
                    )}
                    <div className={`flex-grow min-w-0 ${layout === 'image-right' ? 'text-right' : 'text-left'}`}>
                        <h4 className="font-bold text-4xl text-primary line-clamp-2 mb-4 leading-tight">{currentMessage.headline}</h4>
                        <p className={`text-xl ${secondaryTextClass} line-clamp-12 whitespace-pre-wrap leading-relaxed`}>{currentMessage.body}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};