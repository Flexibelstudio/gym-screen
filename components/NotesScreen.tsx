import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Note, Workout, StudioConfig } from '../types';
import { useStudio } from '../context/StudioContext';
import { uploadImage } from '../services/firebaseService';
import { interpretHandwriting, parseWorkoutFromImage } from '../services/geminiService';

const BoilingCauldron: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M15,85 C15,55 85,55 85,85 Q50,110 15,85 Z" fill="#262626" />
            <path d="M10,60 C10,50 90,50 90,60" stroke="#404040" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M25,85 L20,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
            <path d="M75,85 L80,95" stroke="#262626" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-4/5 h-1/4 overflow-hidden">
            {/* FIX: Cast style object to React.CSSProperties to allow for custom CSS properties. */}
            <div className="bubble" style={{'--i': 11, '--s': 2, left: '10%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 12, '--s': 2.5, left: '30%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 24, '--s': 1.5, left: '80%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 10, '--s': 3, left: '90%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 14, '--s': 2, left: '50%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 23, '--s': 1.5, left: '20%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 18, '--s': 2.5, left: '65%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 20, '--s': 3, left: '40%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 22, '--s': 1.5, left: '75%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 13, '--s': 2, left: '5%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 15, '--s': 2.5, left: '95%'} as React.CSSProperties}></div>
            <div className="bubble" style={{'--i': 19, '--s': 1.5, left: '60%'} as React.CSSProperties}></div>
        </div>
        <style>{`
            .bubble {
                position: absolute;
                bottom: 0;
                width: calc(var(--s) * 4px);
                height: calc(var(--s) * 4px);
                background: #4ade80;
                border-radius: 50%;
                box-shadow: 0 0 2px #4ade80, 0 0 5px #4ade80, 0 0 8px #4ade80;
                animation: bubble-animate calc(15s / var(--i)) linear infinite;
            }
            @keyframes bubble-animate {
                0% { transform: translateY(0) scale(1); opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(-50px) scale(0); opacity: 0; }
            }
        `}</style>
    </div>
);

const AILoadingSpinner: React.FC = () => (
    <div className="relative w-6 h-6">
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1.5s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-1s' }}></div>
        <div className="absolute w-full h-full rounded-full bg-white/70 animate-pulse-loader" style={{ animationDelay: '-0.5s' }}></div>
    </div>
);

// New modal component for the archive
interface NoteArchiveModalProps {
    notes: Note[];
    onClose: () => void;
    onDelete: (noteId: string) => void;
    onUpdate: (note: Note) => void;
    onLoad: (note: Note) => void;
}

const NoteArchiveModal: React.FC<NoteArchiveModalProps> = ({ notes, onClose, onDelete, onUpdate, onLoad }) => {
    const [interpretingId, setInterpretingId] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        if (text) {
            navigator.clipboard.writeText(text);
        }
    };

    const handleInterpret = async (note: Note) => {
        setInterpretingId(note.id);
        try {
            const base64Image = note.imageUrl.split(',')[1];
            const text = await interpretHandwriting(base64Image);
            onUpdate({ ...note, text });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade.');
        } finally {
            setInterpretingId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl h-[90vh] text-white shadow-2xl border border-gray-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold">Arkiverade Anteckningar</h2>
                    <button onClick={onClose} className="font-semibold text-gray-400 hover:text-white">Stäng</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {notes.length === 0 ? (
                        <p className="text-gray-400 text-center mt-10">Arkivet är tomt.</p>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <img src={note.imageUrl} alt="Handskriven anteckning" className="w-full h-auto object-contain rounded-md bg-gray-900" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-500 mb-2">{new Date(note.timestamp).toLocaleString('sv-SE')}</p>
                                    <pre className="flex-grow whitespace-pre-wrap font-sans bg-gray-900 p-3 rounded-md text-gray-200">{note.text || 'Otolkad anteckning...'}</pre>
                                    <div className="flex gap-2 mt-3 flex-shrink-0 flex-wrap">
                                        <button onClick={() => onLoad(note)} className="bg-blue-600 hover:bg-blue-500 text-sm font-semibold py-2 px-3 rounded-md">Fortsätt rita</button>
                                        {note.text ? (
                                            <button onClick={() => handleCopy(note.text)} className="bg-gray-600 hover:bg-gray-500 text-sm font-semibold py-2 px-3 rounded-md">Kopiera text</button>
                                        ) : (
                                            <button onClick={() => handleInterpret(note)} disabled={interpretingId === note.id} className="bg-purple-600 hover:bg-purple-500 text-sm font-semibold py-2 px-3 rounded-md flex items-center gap-1">
                                                {interpretingId === note.id ? 'Tolkar...' : 'Tolka text'}
                                            </button>
                                        )}
                                        <button onClick={() => onDelete(note.id)} className="bg-red-600 hover:bg-red-500 text-sm font-semibold py-2 px-3 rounded-md">Ta bort</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};


// Main NotesScreen component
interface NotesScreenProps {
    savedNotes: Note[];
    onSaveNote: (note: Note) => void;
    onDeleteNote: (noteId: string) => void;
    onUpdateNote: (note: Note) => void;
    onWorkoutInterpreted: (workout: Workout) => void;
    studioConfig: StudioConfig;
}

const ThemeToggleIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
         <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 12a9 9 0 110-18 9 9 0 010 18z" stroke="currentColor"/>
         <path d="M12 12a9 9 0 000 18V0a9 9 0 000 12z" fill="currentColor"/>
    </svg>
);


const NOTES_THEME_STORAGE_KEY = 'flexibel-notes-theme';

// Word cloud animation component
const introWords = [
  // Existing ones, with added colors
  { text: "Idéer", className: "text-6xl text-yellow-300 font-logo" },
  { text: "Kreativitet", className: "text-4xl text-blue-400" },
  { text: "Skissa", className: "text-5xl text-green-400" },
  { text: "Träningspass", className: "text-3xl text-white/90 font-bold" },
  { text: "Struktur", className: "text-4xl text-purple-400" },
  { text: "Glädje", className: "text-5xl text-pink-400 font-logo" },
  { text: "Inspiration", className: "text-2xl text-white/80" },
  { text: "Planera", className: "text-3xl text-indigo-400" },
  { text: "Anteckna", className: "text-4xl text-white/80" },

  // New training-related words with colors
  { text: "Kettlebells", className: "text-4xl text-red-500" },
  { text: "EMOM", className: "text-4xl text-green-300 font-mono" },
  { text: "AMRAP", className: "text-3xl text-blue-300 font-mono" },
  { text: "Tabata", className: "text-5xl text-yellow-400 font-mono uppercase" },
  { text: "Time Cap", className: "text-3xl text-white/60 font-mono" },
  { text: "Stege", className: "text-4xl text-teal-400" },
  { text: "Pyramid", className: "text-4xl text-pink-300" },
  { text: "Flås", className: "text-6xl text-primary font-bold uppercase" },
  { text: "Puls", className: "text-5xl text-red-400" },
  { text: "Core", className: "text-4xl text-yellow-500 font-bold uppercase" },
  { text: "Flow", className: "text-6xl text-blue-500 font-logo" },
  { text: "Mobilitet", className: "text-3xl text-green-500" },
  { text: "Uthållighet", className: "text-4xl text-white/90" },
  { text: "Power", className: "text-5xl text-primary font-bold uppercase" },
  { text: "Laddning", className: "text-3xl text-indigo-300" },
  { text: "Kondition", className: "text-4xl text-white/90 font-bold" },
  { text: "Styrka", className: "text-5xl text-white/90 font-bold" },
  { text: "Lyfta", className: "text-6xl text-red-300" },
  { text: "Svettglädje", className: "text-4xl text-pink-500 font-logo" },
  { text: "WOD", className: "text-5xl text-yellow-200 font-mono uppercase" },
  
  // New idea-related words with colors
  { text: "Skapande", className: "text-4xl text-teal-300" },
  { text: "Vision", className: "text-5xl text-purple-400 font-logo" },
  { text: "Fantasi", className: "text-4xl text-blue-200" },
  { text: "Innovation", className: "text-3xl text-white/90" },
  { text: "Påhitt", className: "text-4xl text-green-200" },
  { text: "Formande", className: "text-3xl text-white/80" },
  { text: "Flöde", className: "text-6xl text-indigo-400 font-logo" },
  { text: "Brainstorm", className: "text-4xl text-white/90 font-bold" },
  { text: "Experiment", className: "text-3xl text-yellow-300" },
  { text: "Lekfullhet", className: "text-4xl text-pink-400 font-logo" },
  { text: "Kreativ puls", className: "text-3xl text-red-400" },
  { text: "Improvisation", className: "text-3xl text-white/80" },
  { text: "Nyskapande", className: "text-4xl text-blue-400" },
  { text: "Bygga", className: "text-5xl text-white/80 font-bold" },
  { text: "Förvandla", className: "text-4xl text-green-400" },
  { text: "Träningsflöde", className: "text-3xl text-teal-500" },
  { text: "Idéstyrka", className: "text-4xl text-primary font-bold" },
  { text: "Skaparsvett", className: "text-4xl text-pink-300 font-logo" },
  { text: "Energiworkout", className: "text-3xl text-yellow-500 font-bold" },

  // Equipment words with colors
  { text: "Hantlar", className: "text-4xl text-gray-400" },
  { text: "Skivstång", className: "text-4xl text-gray-300 font-bold" },
  { text: "Viktplattor", className: "text-3xl text-red-400" },
  { text: "TRX", className: "text-5xl text-yellow-500 font-mono" },
  { text: "Slamballs", className: "text-4xl text-orange-400" },
  { text: "Wall balls", className: "text-4xl text-red-500" },
  { text: "Roddmaskin", className: "text-3xl text-blue-400" },
  { text: "Airbike", className: "text-4xl text-white/90" },
  { text: "Skierg", className: "text-4xl text-blue-300" },
  { text: "Battlerope", className: "text-3xl text-green-400" },
  { text: "Stepbräda", className: "text-3xl text-purple-400" },
  { text: "Plyobox", className: "text-4xl text-indigo-400" },
  { text: "Chinupstång", className: "text-3xl text-gray-500" },
  { text: "Landmine", className: "text-4xl text-yellow-600" },
  { text: "Balansplatta", className: "text-3xl text-pink-400" },
  { text: "Hopprep", className: "text-4xl text-red-300" },
  { text: "Gummiband", className: "text-3xl text-yellow-400" },
  { text: "Miniband", className: "text-3xl text-green-300" },
  { text: "Träningsbänk", className: "text-3xl text-gray-400" },
  { text: "Löpband", className: "text-4xl text-blue-500" },
  { text: "Hyrox", className: "text-6xl text-red-500 font-bold uppercase" },
  { text: "CrossFit", className: "text-6xl text-blue-500 font-bold uppercase" },
];


const IntroAnimation = ({ onSkip }: { onSkip: () => void }) => {
    const randomizedWords = useMemo(() => {
        return introWords
            .sort(() => 0.5 - Math.random()) // Shuffle
            .slice(0, 12) // Take more words
            .map(word => ({
                ...word,
                style: {
                    top: `${10 + Math.random() * 80}%`,
                    left: `${10 + Math.random() * 80}%`,
                    transform: `rotate(${Math.random() * 40 - 20}deg)`,
                    animationDelay: `${Math.random() * 1.5}s`,
                },
            }));
    }, []);

    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center bg-gray-950/50 backdrop-blur-sm">
            <div className="relative w-full h-full flex-grow">
                {randomizedWords.map(({ text, className, style }) => (
                    <span
                        key={text}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 animate-word-cloud-fade-in opacity-0 ${className}`}
                        style={style}
                    >
                        {text}
                    </span>
                ))}
            </div>
            <button
                onClick={onSkip}
                className="flex-shrink-0 bg-black/30 text-white/80 hover:text-white backdrop-blur-sm py-2 px-5 rounded-full text-sm font-semibold transition-colors mt-4"
            >
                Hoppa över
            </button>
        </div>
    );
};

export const NotesScreen: React.FC<NotesScreenProps> = ({ savedNotes, onSaveNote, onDeleteNote, onUpdateNote, onWorkoutInterpreted, studioConfig }) => {
    const { selectedOrganization } = useStudio();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isInterpretingWorkout, setIsInterpretingWorkout] = useState(false);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [history, setHistory] = useState<ImageData[]>([]);
    const [isArchiveVisible, setIsArchiveVisible] = useState(false);
    const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>(() => {
        const savedTheme = localStorage.getItem(NOTES_THEME_STORAGE_KEY) as 'dark' | 'light' | null;
        return savedTheme || 'dark';
    });
    
    const [animationState, setAnimationState] = useState<'intro' | 'exiting' | 'finished'>('intro');
    
    const isDrawing = useRef(false);
    const points = useRef<{x: number, y: number}[]>([]);
    
    useEffect(() => {
        localStorage.setItem(NOTES_THEME_STORAGE_KEY, canvasTheme);
    }, [canvasTheme]);

    const skipAnimation = useCallback(() => {
        setAnimationState('exiting');
    }, []);

    useEffect(() => {
        if (animationState === 'intro') {
            const timer = setTimeout(skipAnimation, 5000);
            return () => clearTimeout(timer);
        }
        if (animationState === 'exiting') {
            const timer = setTimeout(() => setAnimationState('finished'), 500); // Match CSS fade-out
            return () => clearTimeout(timer);
        }
    }, [animationState, skipAnimation]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        const setupCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            
            const width = container.offsetWidth;
            const height = container.offsetHeight;

            if(width === 0 || height === 0) return;

            const newCanvasWidth = Math.round(width * dpr);
            const newCanvasHeight = Math.round(height * dpr);
            
            if (canvas.width !== newCanvasWidth || canvas.height !== newCanvasHeight) {
                canvas.width = newCanvasWidth;
                canvas.height = newCanvasHeight;
            }
            
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
            ctx.strokeStyle = canvasTheme === 'dark' ? '#FFFFFF' : '#000000';
            ctx.lineWidth = 4 * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (history.length > 0) {
                ctx.putImageData(history[history.length - 1], 0, 0);
            }
        };
        
        setupCanvas();

        const resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(setupCanvas);
        });
        resizeObserver.observe(container);

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
            if (animationState !== 'finished') return;
            e.preventDefault();
            isDrawing.current = true;
            points.current = [getPointerPos(e)];
        };

        const draw = (e: PointerEvent) => {
            if (!isDrawing.current || animationState !== 'finished') return;
            e.preventDefault();
            const pos = getPointerPos(e);
            points.current.push(pos);

            if (points.current.length < 3) return;

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
            if (!isDrawing.current || animationState !== 'finished') return;
            isDrawing.current = false;
            
            if (points.current.length < 1) {
                points.current = [];
                return;
            }

            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

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
            resizeObserver.unobserve(container);
            canvas.removeEventListener('pointerdown', startDrawing);
            canvas.removeEventListener('pointermove', draw);
            canvas.removeEventListener('pointerup', stopDrawing);
            canvas.removeEventListener('pointerleave', stopDrawing);
        };
    }, [canvasTheme, animationState]); 

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        setHistory([]);
    };
    
    const handleUndo = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        
        ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (newHistory.length > 0) {
            ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
    };

    const handleSaveNote = async () => {
        if (!canvasRef.current || history.length === 0 || !selectedOrganization) return;
        
        setSaveState('saving');
        setIsSavingNote(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const path = `organizations/${selectedOrganization.id}/notes/${Date.now()}.png`;
            const imageUrl = await uploadImage(path, dataUrl);
            
            const newNote: Note = {
                id: `note-${Date.now()}`,
                timestamp: Date.now(),
                text: '', // Save without interpretation
                imageUrl: imageUrl,
            };

            onSaveNote(newNote);
            clearCanvas();
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);

        } catch(e) {
            alert('Anteckningen kunde inte sparas.');
            setSaveState('idle');
        } finally {
            setIsSavingNote(false);
        }
    };
    
    const handleInterpretAsWorkout = async () => {
        if (!canvasRef.current || history.length === 0) return;
        
        setIsInterpretingWorkout(true);
        try {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            const base64Image = dataUrl.split(',')[1];
            const workout = await parseWorkoutFromImage(base64Image);
            
            onWorkoutInterpreted(workout);
            clearCanvas();

        } catch(e) {
            alert(e instanceof Error ? e.message : 'Ett okänt fel inträffade vid tolkning av pass.');
        } finally {
            setIsInterpretingWorkout(false);
        }
    };

    const handleLoadNote = (note: Note) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        setIsArchiveVisible(false); // Close modal

        const img = new Image();
        img.onload = () => {
            // Clear current canvas before drawing
            ctx.fillStyle = canvasTheme === 'dark' ? '#030712' : '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the loaded image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Set this as the new history
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            setHistory([imageData]);

            // Remove the note from the archive since it's now being edited
            onDeleteNote(note.id);
        };
        img.onerror = () => {
            alert("Kunde inte ladda anteckningen.");
        };
        img.src = note.imageUrl;
    };

    const getSaveButtonContent = () => {
        switch (saveState) {
            case 'saving':
                return <><AILoadingSpinner /><span>Sparar...</span></>;
            case 'saved':
                return <><span>✔️ Sparad!</span></>;
            case 'idle':
            default:
                return <><span>💾 Spara & Arkivera</span></>;
        }
    };
    
    const getInterpretButtonContent = () => {
        if (isInterpretingWorkout) {
            return <><span>Tolkar...</span></>;
        }
        return <><span>✍️ Skapa Pass</span></>;
    };

    const isInteractionDisabled = animationState !== 'finished' || isSavingNote || isInterpretingWorkout;

    return (
        <div className="w-full h-full flex-grow flex flex-col items-stretch justify-center p-4 gap-4 animate-fade-in relative">
            <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
                 <button 
                    onClick={() => setCanvasTheme(prev => prev === 'dark' ? 'light' : 'dark')} 
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold p-2 rounded-lg transition-colors disabled:opacity-50"
                    title="Växla skärmfärg"
                    disabled={animationState !== 'finished'}
                >
                    <ThemeToggleIcon className="w-6 h-6" />
                </button>
                <button onClick={() => setIsArchiveVisible(true)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50" disabled={animationState !== 'finished'}>
                    Visa Arkiv ({savedNotes.length})
                </button>
            </div>

            <div className="flex-grow flex flex-col bg-gray-800 rounded-lg p-4 gap-4 border border-gray-700">
                <div ref={containerRef} className={`w-full flex-grow rounded-lg overflow-hidden relative transition-colors`} style={{ touchAction: 'none' }}>
                    {animationState !== 'finished' && (
                        <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${animationState === 'exiting' ? 'opacity-0' : 'opacity-100'}`}
                             style={{ pointerEvents: animationState === 'exiting' ? 'none' : 'auto' }}
                        >
                           <IntroAnimation onSkip={skipAnimation} />
                        </div>
                    )}
                    <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onClick={handleUndo} disabled={history.length === 0 || isInteractionDisabled} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">Ångra</button>
                    <button onClick={clearCanvas} disabled={isInteractionDisabled} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">Rensa</button>
                    <button onClick={handleSaveNote} disabled={isInteractionDisabled || history.length === 0 || saveState !== 'idle'} className="bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {getSaveButtonContent()}
                    </button>
                    <button onClick={handleInterpretAsWorkout} disabled={isInteractionDisabled || history.length === 0} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {getInterpretButtonContent()}
                    </button>
                </div>
            </div>

            {isInterpretingWorkout && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center animate-fade-in">
                    <BoilingCauldron className="w-48 h-48" />
                    <p className="text-5xl text-white mt-4 font-logo">Kokar ihop ditt pass</p>
                </div>
            )}

            {isArchiveVisible && (
                <NoteArchiveModal
                    notes={savedNotes}
                    onClose={() => setIsArchiveVisible(false)}
                    onDelete={onDeleteNote}
                    onUpdate={onUpdateNote}
                    onLoad={handleLoadNote}
                />
            )}
        </div>
    );
};
