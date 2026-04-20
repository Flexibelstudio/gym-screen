import React, { useRef, useState, useEffect } from 'react';
import { Modal } from './Modal';

export const WebCamCaptureModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCapture: (base64String: string) => void;
}> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    const startCamera = async () => {
        setError(null);
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error("Camera error:", err);
            setError("Kunde inte starta kameran. Kontrollera behörigheter.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                onCapture(dataUrl);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Fota">
            <div className="flex flex-col items-center">
                {error ? (
                    <div className="text-red-500 text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                        {error}
                        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg">Avbryt</button>
                    </div>
                ) : (
                    <>
                        <div className="relative w-full rounded-xl overflow-hidden bg-black mb-4 aspect-[4/3] flex items-center justify-center">
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="flex justify-center gap-4 w-full">
                            <button 
                                onClick={handleCapture}
                                className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full flex items-center gap-2 shadow-lg"
                            >
                                📸 Ta Bild
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
