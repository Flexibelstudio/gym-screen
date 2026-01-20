
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LazyImageProps {
    src?: string;
    alt: string;
    className?: string;
    placeholderIcon?: React.ReactNode;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className = "", placeholderIcon }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    return (
        <div className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}>
            <AnimatePresence>
                {(!isLoaded || hasError) && (
                    <motion.div 
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        {hasError || !src ? (
                            <div className="opacity-20">{placeholderIcon}</div>
                        ) : (
                            <div className="w-full h-full animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 bg-[length:200%_100%] shimmer-animation"></div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {src && !hasError && (
                <motion.img
                    src={src}
                    alt={alt}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isLoaded ? 1 : 0 }}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    className={`w-full h-full object-cover ${className}`}
                />
            )}

            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .shimmer-animation {
                    animation: shimmer 1.5s infinite linear;
                }
            `}</style>
        </div>
    );
};
