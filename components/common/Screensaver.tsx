
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
        const speed = 75; // pixels per second for consistent movement
        const angle = Math.random() * 2 * Math.PI;
        return {
            pos: { x: 0, y: 0 },
            vel: { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) },
            size: { w: 0, h: 0 }
        };
    }));
    const animationFrameId = useRef<number>();
    
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
                elState.pos.x = Math.random() * (containerRect.width - elState.size.w);
                elState.pos.y = Math.random() * (availableHeight - elState.size.h);
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

            // Update sizes and positions, and check for wall collisions
            elementsState.current.forEach((elState, index) => {
                const el = elementRefs[index].current;
                if (el) {
                    const rect = el.getBoundingClientRect();
                    // Dynamically update size if it has been rendered and is valid
                    if (rect.width > 0 && rect.height > 0) {
                        elState.size.w = rect.width;
                        elState.size.h = rect.height;
                    }
                }

                elState.pos.x += elState.vel.vx * deltaTime;
                elState.pos.y += elState.vel.vy * deltaTime;

                // Wall collision with boundary correction
                if (elState.pos.x < 0) {
                    elState.pos.x = 0;
                    elState.vel.vx *= -1;
                } else if (elState.pos.x > currentContainerRect.width - elState.size.w) {
                    elState.pos.x = currentContainerRect.width - elState.size.w;
                    elState.vel.vx *= -1;
                }

                if (elState.pos.y < 0) {
                    elState.pos.y = 0;
                    elState.vel.vy *= -1;
                } else if (elState.pos.y > currentAvailableHeight - elState.size.h) {
                    // Bounce off the "floor" created by the bottomOffset
                    elState.pos.y = currentAvailableHeight - elState.size.h;
                    elState.vel.vy *= -1;
                }
            });
            
            // Inter-element collision (Reflection method)
            if (elementsState.current.length > 1) {
                const [el1, el2] = elementsState.current;
                
                // Check for valid sizes before doing collision math
                if (el1.size.w > 0 && el2.size.w > 0) {
                    // Check for bounding box overlap
                    if (
                        el1.pos.x < el2.pos.x + el2.size.w &&
                        el1.pos.x + el1.size.w > el2.pos.x &&
                        el1.pos.y < el2.pos.y + el2.size.h &&
                        el1.pos.y + el1.size.h > el2.pos.y
                    ) {
                        // Calculate center-to-center vector (collision normal)
                        const dx = (el2.pos.x + el2.size.w / 2) - (el1.pos.x + el1.size.w / 2);
                        const dy = (el2.pos.y + el2.size.h / 2) - (el1.pos.y + el1.size.h / 2);
                        
                        const relVelX = el1.vel.vx - el2.vel.vx;
                        const relVelY = el1.vel.vy - el2.vel.vy;
                        
                        // Only resolve if objects are moving towards each other to prevent sticking
                        if (dx * relVelX + dy * relVelY < 0) {
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // Prevent division by zero
                            if (distance > 0) {
                                // Normalized collision normal
                                const nx = dx / distance;
                                const ny = dy / distance;

                                // --- Reflect velocities ---
                                // Reflect el1's velocity
                                const dot1 = el1.vel.vx * nx + el1.vel.vy * ny;
                                el1.vel.vx -= 2 * dot1 * nx;
                                el1.vel.vy -= 2 * dot1 * ny;

                                // Reflect el2's velocity
                                const dot2 = el2.vel.vx * nx + el2.vel.vy * ny;
                                el2.vel.vx -= 2 * dot2 * nx;
                                el2.vel.vy -= 2 * dot2 * ny;

                                // --- Overlap Correction ---
                                // A simple nudge to prevent objects from sticking.
                                const r1 = (el1.size.w + el1.size.h) / 4; // Avg radius approximation
                                const r2 = (el2.size.w + el2.size.h) / 4;
                                const overlap = (r1 + r2) - distance;
                                
                                if (overlap > 0) {
                                    const pushX = (overlap * nx) / 2;
                                    const pushY = (overlap * ny) / 2;
                                    
                                    el1.pos.x -= pushX;
                                    el1.pos.y -= pushY;
                                    el2.pos.x += pushX;
                                    el2.pos.y += pushY;
                                }
                            }
                        }
                    }
                }
            }


            // Apply styles
            elementsState.current.forEach((elState, index) => {
                const el = elementRefs[index].current;
                if (el) {
                    el.style.transform = `translate(${elState.pos.x}px, ${elState.pos.y}px)`;
                }
            });

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
    
    const elementRefs = useMemo(() => [clockRef, logoRef], []);
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
                className="absolute top-0 left-0 text-white font-mono text-9xl font-bold"
                style={{ willChange: 'transform' }}
            >
                {time}
            </div>
            {logoUrl && (
                 <div 
                    ref={logoRef} 
                    className="absolute top-0 left-0 w-80 h-80"
                    style={{ willChange: 'transform' }}
                >
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
            )}
        </div>
    );
};
