import React, { useState } from 'react';
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

    return (
        <motion.div
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

                {/* Resize Handle med framer-motion onPan */}
                <motion.div 
                    className="absolute bottom-0 right-0 w-24 h-24 cursor-se-resize bg-slate-800/80 hover:bg-primary flex items-center justify-center rounded-tl-full transition-colors z-[60] pointer-events-auto border-l-2 border-t-2 border-white/10"
                    onPan={(event, info) => {
                        setSize(prev => ({
                            width: Math.max(300, prev.width + info.delta.x),
                            height: Math.max(300, prev.height + info.delta.y),
                        }));
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ touchAction: 'none' }}
                >
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white translate-x-3 translate-y-3">
                        <path d="M21 15L15 21M21 8L8 21M21 21H8H21ZM21 21V15V21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </motion.div>
            </div>
        </motion.div>
    );
};