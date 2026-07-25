import React, { useState, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';

interface DraggableImageProps {
    src: string;
    alt: string;
    initialPosition?: { x: number, y: number };
    onClose?: () => void;
    children?: React.ReactNode;
}

export const DraggableImage: React.FC<DraggableImageProps> = ({ src, alt, initialPosition = { x: 50, y: 50 }, onClose, children }) => {
    // Gör den MYCKET STÖRRE direkt, till exempel 600x800
    const [size, setSize] = useState({ width: 600, height: 800 });
    const dragControls = useDragControls();
    const containerRef = useRef<HTMLDivElement>(null);
    const sizeRef = useRef({ width: 600, height: 800 });
    const rafId = useRef<number | null>(null);

    const handleResizePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startW = sizeRef.current.width;
        const startH = sizeRef.current.height;

        const onPointerMove = (moveEv: PointerEvent) => {
            const dx = moveEv.clientX - startX;
            const dy = moveEv.clientY - startY;

            if (rafId.current !== null) return;
            rafId.current = requestAnimationFrame(() => {
                rafId.current = null;
                const newW = Math.max(300, startW + dx);
                const newH = Math.max(300, startH + dy);
                sizeRef.current = { width: newW, height: newH };
                if (containerRef.current) {
                    containerRef.current.style.width = `${newW}px`;
                    containerRef.current.style.height = `${newH}px`;
                }
            });
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
                rafId.current = null;
            }
            setSize({ ...sizeRef.current });
        };

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerUp);
    };

    return (
        <motion.div
            ref={containerRef as any}
            drag
            dragControls={dragControls}
            dragListener={false} // Egen listener inuti! Så inte resizern hänger med
            dragMomentum={false}
            initial={initialPosition}
            style={{
                position: 'fixed', 
                width: size.width,
                height: size.height,
                zIndex: 50, // hög z-index
                touchAction: 'none',
            }}
            className="group touch-none pointer-events-auto rounded-2xl shadow-2xl"
        >
            <div className="relative w-full h-full bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border-2 border-white/20 flex flex-col">
                {/* Drag Handle & Image container */}
                <div 
                    className="w-full h-full active:cursor-grabbing cursor-grab flex items-center justify-center p-2"
                    onPointerDown={(e) => {
                        dragControls.start(e);
                    }}
                >
                    <img 
                        src={src} 
                        alt={alt} 
                        className="w-full h-full object-contain pointer-events-none" 
                    />
                </div>
                
                {onClose && (
                    <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="absolute top-3 right-3 bg-red-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl opacity-80 hover:opacity-100 transition-opacity z-50 shadow-xl hover:bg-red-600 pointer-events-auto border-2 border-white/50"
                        title="Stäng bild"
                    >
                        ✕
                    </button>
                )}

                {children}

                {/* Resize Handle */}
                <div 
                    className="absolute bottom-0 right-0 w-24 h-24 cursor-se-resize bg-slate-800/80 hover:bg-primary flex items-center justify-center rounded-tl-full transition-colors z-[60] pointer-events-auto border-l-2 border-t-2 border-white/10"
                    onPointerDown={handleResizePointerDown}
                    style={{ touchAction: 'none' }}
                >
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white translate-x-3 translate-y-3">
                        <path d="M21 15L15 21M21 8L8 21M21 21H8H21ZM21 21V15V21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
        </motion.div>
    );
};