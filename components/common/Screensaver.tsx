import React, { useState, useEffect, useRef, useMemo } from 'react';

const formatTimeForScreensaver = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const useBouncingPhysics = (
  containerRef: React.RefObject<HTMLDivElement>, 
  elementRefs: React.RefObject<HTMLDivElement>[],
  bottomOffset: number = 0
) => {
    const elementsState = useRef(elementRefs.map(() => {
        // Reduced speed slightly for a smoother, more premium feel
        const speed = 60; 
        const angle = Math.random() * 2 * Math.PI;
        return {
            pos: { x: 0, y: 0 },
            vel: { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) },
            size: { w: 0, h: 0 }
        };
    }));
    const animationFrameId = useRef<number | null>(null);
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Initialize positions
        const containerRect = container.getBoundingClientRect();
        const availableHeight = containerRect.height - bottomOffset;

        elementsState.current.forEach((elState, index) => {
            const el = elementRefs[index].current;
            if(el) {
                const elRect = el.getBoundingClientRect();
                elState.size.w = elRect.width;
                elState.size.h = elRect.height;
                // Random start position within bounds
                elState.pos.x = Math.random() * Math.max(0, containerRect.width - elState.size.w);
                elState.pos.y = Math.random() * Math.max(0, availableHeight - elState.size.h);
            }
        });
        
        let lastTime: number | null = null;
        const animate = (time: number) => {
            const container = containerRef.current;
            if (!container) return;
            
            if (lastTime === null) {
                lastTime = time;
                animationFrameId.current = requestAnimationFrame(animate);
                return;
            }
            let deltaTime = (time - lastTime) / 1000;
            // Cap delta time to avoid huge jumps when tab is backgrounded
            if (deltaTime > 0.1) {
                deltaTime = 0.1;
            }
            const currentContainerRect = container.getBoundingClientRect();
            const currentAvailableHeight = currentContainerRect.height - bottomOffset;

            elementsState.current.forEach((elState, index) => {
                const el = elementRefs[index].current;
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // We assume size is relatively stable, but we check to ensure we stay in bounds if it changes
                    if (rect.width > 0 && rect.height > 0) {
                        elState.size.w = rect.width;
                        elState.size.h = rect.height;
                    }
                }

                elState.pos.x += elState.vel.vx * deltaTime;
                elState.pos.y += elState.vel.vy * deltaTime;

                // --- Wall collision with boundary correction ---
                
                // Right wall
                if (elState.pos.x + elState.size.w > currentContainerRect.width) {
                    elState.pos.x = currentContainerRect.width - elState.size.w;
                    elState.vel.vx = -Math.abs(elState.vel.vx);
                } 
                // Left wall
                else if (elState.pos.x < 0) {
                    elState.pos.x = 0;
                    elState.vel.vx = Math.abs(elState.vel.vx);
                }

                // Bottom wall (considering offset)
                if (elState.pos.y + elState.size.h > currentAvailableHeight) {
                    elState.pos.y = currentAvailableHeight - elState.size.h;
                    elState.vel.vy = -Math.abs(elState.vel.vy);
                } 
                // Top wall
                else if (elState.pos.y < 0) {
                    elState.pos.y = 0;
                    elState.vel.vy = Math.abs(elState.vel.vy);
                }
                
                // Apply transform directly using translate3d for GPU acceleration
                if (el) {
                    el.style.transform = `translate3d(${elState.pos.x}px, ${elState.pos.y}px, 0)`;
                }
            });

            // Note: Object-to-object collision removed to prevent sticking and improve smoothness ("DVD Logo" style).

            lastTime = time;
            animationFrameId.current = requestAnimationFrame(animate);
        };
        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [containerRef, elementRefs, bottomOffset]);
};


interface ScreensaverProps {
    logoUrl?: string | null;
    bottomOffset?: number;
}

export const Screensaver: React.FC<ScreensaverProps> = ({ logoUrl, bottomOffset = 0 }) => {
    const [time, setTime] = useState(formatTimeForScreensaver(new Date()));
    const containerRef = useRef<HTMLDivElement>(null);
    const clockRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    
    // Create refs array only for existing elements to avoid processing nulls in physics loop
    const elementRefs = useMemo(() => {
        const refs = [clockRef];
        if (logoUrl) refs.push(logoRef);
        return refs;
    }, [logoUrl]);

    useBouncingPhysics(containerRef, elementRefs, bottomOffset);

    useEffect(() => {
        const timerId = setInterval(() => {
            setTime(formatTimeForScreensaver(new Date()));
        }, 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div ref={containerRef} className="fixed inset-0 bg-black z-[1000] cursor-none animate-fade-in overflow-hidden">
            <div 
                ref={clockRef} 
                className="absolute top-0 left-0 text-white font-mono text-9xl font-bold p-4 bg-black/30 rounded-2xl backdrop-blur-sm shadow-2xl"
                style={{ willChange: 'transform' }}
            >
                {time}
            </div>
            {logoUrl && (
                 <div 
                    ref={logoRef} 
                    className="absolute top-0 left-0 w-80 h-80 p-4"
                    style={{ willChange: 'transform' }}
                >
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain drop-shadow-2xl" />
                </div>
            )}
        </div>
    );
};