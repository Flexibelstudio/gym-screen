
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CloseIcon, RefreshIcon } from './icons';

interface WebQRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

declare global {
    interface Window {
        jsQR: any;
    }
}

export const WebQRScanner: React.FC<WebQRScannerProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const requestRef = useRef<number>(null);

    const startCamera = async () => {
        setError(null);
        setPermissionDenied(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute("playsinline", "true"); 
                // Wait for the video to be ready to play
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().catch(e => console.error("Play error:", e));
                    requestRef.current = requestAnimationFrame(tick);
                };
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setPermissionDenied(true);
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError("Ingen kamera hittades på denna enhet.");
            } else {
                setError("Kunde inte starta kameran. Kontrollera webbläsarens inställningar.");
            }
        }
    };

    useEffect(() => {
        startCamera();

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const tick = () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (canvas && video) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    
                    // jsQR laddas via CDN i index.html och finns på window
                    if (window.jsQR) {
                        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        });
                        if (code) {
                            onScan(code.data);
                            return; // Sluta scanna när vi hittat en kod
                        }
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(tick);
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[11000] bg-white/90 dark:bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4"
        >
            <div className="w-full max-w-md relative aspect-square bg-gray-900 rounded-3xl overflow-hidden border-4 border-gray-200 dark:border-gray-800 shadow-2xl">
                {!permissionDenied && !error && (
                    <>
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        
                        {/* Scanner UI Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-2 border-primary/30 rounded-2xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(var(--color-primary),0.5)]"></div>
                                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/50 animate-pulse shadow-[0_0_10px_rgba(var(--color-primary),0.8)]"></div>
                            </div>
                        </div>
                    </>
                )}

                {permissionDenied && (
                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </div>
                        <h3 className="text-white font-bold text-xl mb-2">Kameraåtkomst nekad</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            Webbläsaren har blockerat kameran. Du måste tillåta den manuellt för att kunna scanna.
                        </p>
                        <div className="bg-gray-800 p-4 rounded-xl text-left w-full mb-6">
                            <p className="text-xs text-gray-300 font-bold mb-2 uppercase tracking-wider">Gör så här:</p>
                            <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
                                <li>Klicka på ikonen i adressfältet (🔒 eller 📷).</li>
                                <li>Välj <strong>Tillåt</strong> eller <strong>Återställ behörighet</strong> för kamera.</li>
                                <li>Klicka på knappen nedan.</li>
                            </ol>
                        </div>
                        <button 
                            onClick={startCamera}
                            className="bg-primary hover:brightness-110 text-white font-bold py-3 px-8 rounded-xl transition-all active:scale-95 flex items-center gap-2"
                        >
                            <RefreshIcon className="w-5 h-5" />
                            Försök igen
                        </button>
                    </div>
                )}

                {error && !permissionDenied && (
                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
                        <p className="text-white font-bold text-lg mb-4">{error}</p>
                        <button 
                            onClick={startCamera}
                            className="text-primary font-bold text-sm hover:underline"
                        >
                            Försök igen
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-8 text-center">
                <h3 className="text-gray-900 dark:text-white text-xl font-bold mb-2 uppercase tracking-tight">Scanna QR-kod</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">Håll koden på skärmen framför kameran för att logga passet.</p>
            </div>

            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-4 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-gray-600 dark:text-white transition-all active:scale-90 shadow-md border border-gray-200 dark:border-gray-800"
            >
                <CloseIcon className="w-8 h-8" />
            </button>
        </motion.div>
    );
};
