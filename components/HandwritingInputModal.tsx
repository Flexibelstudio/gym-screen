
import React, { useState, useEffect, useRef } from 'react';
import { interpretHandwriting } from '../services/geminiService';

interface HandwritingInputModalProps {
    onClose: () => void;
    onComplete: (text: string) => void;
}

export const HandwritingInputModal: React.FC<HandwritingInputModalProps> = ({ onClose, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    
    // Use a ref to pass the latest history to the resize observer callback without re-triggering the effect.
    const historyRef = useRef(history);
    historyRef.current = history;
    
    // Refs to manage drawing state without causing re-renders
    const isDrawing = useRef(false);
    const points = useRef<{x: number, y: number}[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect(); 
            if(rect.width === 0 || rect.height === 0) return;

            // Set the actual pixel size of the canvas to match its display size
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            
            // Re-apply drawing styles as they are reset when canvas size changes
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        const resizeObserver = new ResizeObserver(() => {
            // Defer resize handling to the next animation frame to avoid resize loop errors.
            window.requestAnimationFrame(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                setupCanvas();
                // Restore the last state from history after resize, using the ref for the latest value.
                const currentHistory = historyRef.current;
                if (currentHistory.length > 0) {
                     const lastImageData = currentHistory[currentHistory.length - 1];
                     const tempCanvas = document.createElement('canvas');
                     const tempCtx = tempCanvas.getContext('2d');
                     if (tempCtx) {
                        tempCanvas.width = lastImageData.width;
                        tempCanvas.height = lastImageData.height;
                        tempCtx.putImageData(lastImageData, 0, 0);
                        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                     }
                }
            });
        });
        resizeObserver.observe(canvas);

        const getPointerPos = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return { 
                x: (e.clientX - rect.left) * scaleX, 
                y: (e.clientY - rect.top) * scaleY 
            };
        };

        const startDrawing = (e: PointerEvent) => {
            e.preventDefault();
            isDrawing.current = true;
            const pos = getPointerPos(e);
            points.current = [pos];
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current) return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);

            if (points.current.length < 3) return;

            // Draw a quadratic curve segment between midpoints
            const p1 = points.current[points.current.length - 3];
            const p2 = points.current[points.current.length - 2];
            const p3 = points.current[points.current.length - 1];

            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            
            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
            ctx.stroke();
        };

        const stopDrawing = () => {
            if (!isDrawing.current) return;
            isDrawing.current = false;
            
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx || points.current.length < 1) {
                points.current = [];
                return;
            }

            // Handle dots and short lines that didn't trigger curve drawing
            if (points.current.length === 1) {
                const p1 = points.current[0];
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (points.current.length === 2) {
                const p1 = points.current[0];
                const p2 = points.current[1];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory(prev => [...prev, imageData]);
            points.current = [];
        };

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', stopDrawing);
        canvas.addEventListener('pointerleave', stopDrawing);

        return () => {
            resizeObserver.unobserve(canvas);
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, []); // Empty dependency array is correct as we use a ref to access latest history.

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHistory([]);
    };
    
    const handleUndo = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (newHistory.length > 0) {
            ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
    };

    const handleInterpret = async () => {
        if (!canvasRef.current) return;
        setIsLoading(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            const text = await interpretHandwriting(base64Image);
            onComplete(text);
        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-2xl text-white shadow-2xl border border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Skriv med fingret</h2>
                <div className="w-full aspect-[2/1] bg-gray-900 rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                {isLoading && (
                     <div className="absolute inset-0 bg-gray-800/70 flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold">Tolkar handstil...</p>
                    </div>
                )}
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-4">
                    <button onClick={handleUndo} disabled={history.length === 0} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Ångra</button>
                    <button onClick={clearCanvas} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg">Rensa</button>
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 font-bold py-3 rounded-lg">Avbryt</button>
                    <button onClick={handleInterpret} className="bg-primary hover:brightness-95 font-bold py-3 rounded-lg">Tolka</button>
                </div>
            </div>
        </div>
    );
};
