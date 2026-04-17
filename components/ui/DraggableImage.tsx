import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface DraggableImageProps {
    src: string;
    alt: string;
    initialPosition?: { x: number, y: number };
    onClose?: () => void;
    children?: React.ReactNode;
}

export const DraggableImage: React.FC<DraggableImageProps> = ({ src, alt, initialPosition = { x: 50, y: 50 }, onClose, children }) => {
    const [size, setSize] = useState({ width: 300, height: 400 });
    const [isResizing, setIsResizing] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    // Initial logic to maintain aspect ratio could go here, 
    // but for now we give it a default starting size.

    return (
        <motion.div
            drag={!isResizing}
            dragMomentum={false}
            initial={initialPosition}
            style={{
                position: 'fixed', // Use fixed, not absolute inside a container
                width: size.width,
                height: size.height,
                zIndex: 40 + (isResizing ? 10 : 0),
                // Center it initially if we want, but Framer Motion initial overrides
            }}
            className="group touch-none pointer-events-auto shadow-2xl rounded-xl"
        >
            <div className="relative w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-white/20">
                <img 
                    ref={imageRef}
                    src={src} 
                    alt={alt} 
                    className="w-full h-full object-contain pointer-events-none" // prevent img from intercepting drag
                />
                
                {onClose && (
                    <button 
                        onPointerDownCapture={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md hover:bg-red-600 pointer-events-auto"
                        title="Stäng bild"
                    >
                        ✕
                    </button>
                )}

                {children}

                {/* Resize Handle */}
                <div 
                    className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize bg-black/20 hover:bg-primary/80 flex items-center justify-center rounded-tl-lg transition-colors opacity-0 group-hover:opacity-100 z-[60] pointer-events-auto"
                    onPointerDownCapture={(e) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                        e.stopPropagation(); // prevent triggering parent drag
                        e.nativeEvent.stopImmediatePropagation();
                        
                        setIsResizing(true);
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startWidth = size.width;
                        const startHeight = size.height;

                        const handlePointerMove = (moveEvent: PointerEvent) => {
                            moveEvent.preventDefault();
                            moveEvent.stopPropagation();
                            setSize({
                                width: Math.max(150, startWidth + (moveEvent.clientX - startX)),
                                height: Math.max(150, startHeight + (moveEvent.clientY - startY)),
                            });
                        };

                        const handlePointerUp = (upEvent: PointerEvent) => {
                            upEvent.stopPropagation();
                            setIsResizing(false);
                            window.removeEventListener('pointermove', handlePointerMove);
                            window.removeEventListener('pointerup', handlePointerUp);
                        };

                        window.addEventListener('pointermove', handlePointerMove);
                        window.addEventListener('pointerup', handlePointerUp);
                    }}
                >
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white">
                        <path d="M21 15L15 21M21 8L8 21M21 21H8H21ZM21 21V15V21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
        </motion.div>
    );
};