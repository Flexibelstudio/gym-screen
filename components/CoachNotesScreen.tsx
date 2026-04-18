import React, { useState, useEffect, useRef } from 'react';
import { Page, CoachNote } from '../types';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';
import { listenToCoachNotes, saveCoachNote, toggleCoachNoteFavorite, deleteCoachNote, uploadImage, updateCoachNote } from '../services/firebaseService';
import { chatWithNotesAssistant } from '../services/geminiService';
import { Modal } from './ui/Modal';
import { WebCamCaptureModal } from './ui/WebCamCaptureModal';
import { CloseIcon, PlusIcon, TrashIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface CoachNotesScreenProps {
    onBack: () => void;
}

export const CoachNotesScreen: React.FC<CoachNotesScreenProps> = ({ onBack }) => {
    const { userData } = useAuth();
    const { selectedOrganization } = useStudio();
    const [notes, setNotes] = useState<CoachNote[]>([]);
    const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isWebCamOpen, setIsWebCamOpen] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', content: string}[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isChatOpen) {
            scrollToBottom();
        }
    }, [chatMessages, isChatOpen]);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;
        
        const newMessages: {role: 'user'|'assistant', content: string}[] = [
            ...chatMessages,
            { role: 'user', content: chatInput }
        ];
        
        setChatMessages(newMessages);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const response = await chatWithNotesAssistant(chatMessages, chatInput);
            setChatMessages([...newMessages, { role: 'assistant', content: response.replyText }]);
        } catch (error) {
            console.error("Chat error:", error);
            alert("Kunde inte få svar från AI-Coachen.");
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleSaveFromChat = (text: string) => {
        setIsChatOpen(false);
        setEditingNoteId(null);
        setNewImage(null);
        setNewImagePreview(null);
        setNewText(text);
        setNewTitle('AI Förslag ' + new Date().toLocaleDateString('sv-SE'));
        setIsCreateModalOpen(true);
    };

    // Create Note State
    const [newTitle, setNewTitle] = useState('');
    const [newText, setNewText] = useState('');
    const [newImage, setNewImage] = useState<File | null>(null);
    const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!selectedOrganization?.id) return;
        const unsubscribe = listenToCoachNotes(selectedOrganization.id, (fetchedNotes) => {
            // Only show notes created by the current user in this view
            const myNotes = fetchedNotes.filter(n => n.createdBy === userData?.uid);
            setNotes(myNotes);
        });
        return () => unsubscribe();
    }, [selectedOrganization?.id, userData?.uid]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveNote = async () => {
        if (!selectedOrganization?.id || !userData?.uid) return;
        if (!newText.trim() && !newImage && !newImagePreview) {
            alert("Du måste lägga till text eller en bild.");
            return;
        }

        setIsSaving(true);
        try {
            let imageUrl = '';
            
            if (newImage || newImagePreview) {
                const { resizeAndCompressImage } = await import('../utils/imageResize');
                if (newImage) {
                    imageUrl = await resizeAndCompressImage(newImage, 1000, 1000, 0.7);
                } else if (newImagePreview) {
                    imageUrl = await resizeAndCompressImage(newImagePreview, 1000, 1000, 0.7);
                }
            }

            if (editingNoteId) {
                let finalImageUrl = imageUrl || (newImagePreview && !newImagePreview.startsWith('data:image') ? newImagePreview : '');
                
                await updateCoachNote(editingNoteId, {
                    title: newTitle.trim() || `Anteckning ${new Date().toLocaleDateString('sv-SE')}`,
                    text: newText.trim(),
                    imageUrl: finalImageUrl || null // Allow nulling out existing image
                });
            } else {
                await saveCoachNote({
                    organizationId: selectedOrganization.id,
                    createdBy: userData.uid,
                    creatorName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Coach',
                    creatorPhotoUrl: userData.photoUrl,
                    title: newTitle.trim() || `Anteckning ${new Date().toLocaleDateString('sv-SE')}`,
                    text: newText.trim(),
                    imageUrl: imageUrl || undefined,
                    isFavorite: false
                });
            }

            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewText('');
            setNewImage(null);
            setNewImagePreview(null);
            setEditingNoteId(null);
        } catch (error) {
            console.error("Failed to save note:", error);
            alert("Ett fel uppstod när anteckningen skulle sparas.");
        } finally {
            setIsSaving(false);
        }
    };

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const activeNotes = notes.filter(n => n.isFavorite || (now - n.createdAt) <= FOURTEEN_DAYS_MS);
    const archivedNotes = notes.filter(n => !n.isFavorite && (now - n.createdAt) > FOURTEEN_DAYS_MS);

    let displayedNotes = activeTab === 'active' ? activeNotes : archivedNotes;
    
    if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        displayedNotes = displayedNotes.filter(n => 
            n.title?.toLowerCase().includes(lowerQuery) || 
            n.text?.toLowerCase().includes(lowerQuery)
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Anteckningar</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsChatOpen(true)}
                        className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                        💬 Chatta med AI
                    </button>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-lg"
                    >
                        <PlusIcon className="w-5 h-5" /> Ny Anteckning
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                <button 
                    onClick={() => setActiveTab('active')}
                    className={`pb-2 px-4 font-bold text-lg transition-colors relative ${activeTab === 'active' ? 'text-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Aktiva & Favoriter
                    {activeTab === 'active' && <div className="absolute bottom-[-9px] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setActiveTab('archive')}
                    className={`pb-2 px-4 font-bold text-lg transition-colors relative ${activeTab === 'archive' ? 'text-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Arkiv
                    {activeTab === 'archive' && <div className="absolute bottom-[-9px] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                </button>
            </div>

            {/* Sökruta */}
            <div className="mb-8 relative max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                </div>
                <input 
                    type="text"
                    placeholder="Sök bland anteckningar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-shadow"
                />
            </div>

            {displayedNotes.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-200 dark:border-gray-800">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Inga anteckningar här</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {activeTab === 'active' ? 'Klicka på "Ny Anteckning" för att spara pass, skisser och idéer.' : 'Arkivet är tomt. Gamla anteckningar som inte är favoriter hamnar här automatiskt efter 14 dagar.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence>
                        {displayedNotes.map(note => (
                            <motion.div 
                                key={note.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col group"
                            >
                                {note.imageUrl && (
                                    <div className="w-full h-48 bg-gray-100 dark:bg-gray-900 relative">
                                        <img src={note.imageUrl} alt={note.title} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-5 flex-grow flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg line-clamp-1">{note.title}</h3>
                                        <button 
                                            onClick={() => toggleCoachNoteFavorite(note.id, !note.isFavorite)}
                                            className="text-2xl hover:scale-110 transition-transform"
                                        >
                                            {note.isFavorite ? '⭐️' : '☆'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        {new Date(note.createdAt).toLocaleDateString('sv-SE')}
                                    </p>
                                    {note.text && (
                                        <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-4 flex-grow whitespace-pre-wrap">
                                            {note.text}
                                        </p>
                                    )}
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => {
                                                setEditingNoteId(note.id);
                                                setNewTitle(note.title);
                                                setNewText(note.text || '');
                                                setNewImagePreview(note.imageUrl || null);
                                                setNewImage(null);
                                                setIsCreateModalOpen(true);
                                            }}
                                            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm('Är du säker på att du vill radera denna anteckning?')) {
                                                    deleteCoachNote(note.id, note.imageUrl);
                                                }
                                            }}
                                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            <Modal isOpen={isCreateModalOpen} onClose={() => {
                if(!isSaving) {
                    setIsCreateModalOpen(false);
                    setEditingNoteId(null);
                    setNewTitle('');
                    setNewText('');
                    setNewImage(null);
                    setNewImagePreview(null);
                }
            }} title={editingNoteId ? "Redigera Anteckning" : "Ny Anteckning"} size="lg">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Titel (Valfritt)</label>
                        <input 
                            type="text" 
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder={`Anteckning ${new Date().toLocaleDateString('sv-SE')}`}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bild / Foto</label>
                        {newImagePreview ? (
                            <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
                                <img src={newImagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                                <button 
                                    onClick={() => { setNewImage(null); setNewImagePreview(null); }}
                                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 backdrop-blur-sm"
                                >
                                    <CloseIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div 
                                    onClick={() => {
                                        // On mobile browser, 'capture' works best opening native camera.
                                        // On desktop, the native input just acts as a file picker, so we use HTML5 camera instead.
                                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                                        if (isMobile) {
                                            cameraInputRef.current?.click();
                                        } else {
                                            setIsWebCamOpen(true);
                                        }
                                    }}
                                    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-primary hover:border-primary cursor-pointer transition-colors"
                                >
                                    <div className="text-4xl mb-2">📸</div>
                                    <span className="font-bold text-center">Fota</span>
                                </div>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-primary hover:border-primary cursor-pointer transition-colors"
                                >
                                    <div className="text-4xl mb-2">🖼️</div>
                                    <span className="font-bold text-center">Välj bild</span>
                                </div>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            ref={cameraInputRef} 
                            onChange={handleImageSelect} 
                            style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
                        />
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleImageSelect} 
                            style={{ position: 'absolute', opacity: 0, width: 1, height: 1, overflow: 'hidden' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Text / Upplägg</label>
                        <textarea 
                            value={newText}
                            onChange={e => setNewText(e.target.value)}
                            placeholder="Skriv ner passet, idéer eller kommentarer..."
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none min-h-[150px] resize-y"
                        />
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button 
                            onClick={() => setIsCreateModalOpen(false)}
                            disabled={isSaving}
                            className="flex-1 py-4 rounded-xl font-bold bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Avbryt
                        </button>
                        <button 
                            onClick={handleSaveNote}
                            disabled={isSaving || (!newText.trim() && !newImage && !newImagePreview)}
                            className="flex-1 py-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex justify-center items-center"
                        >
                            {isSaving ? 'Sparar...' : 'Spara Anteckning'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} title="💬 AI-Coachen" size="2xl">
                <div className="flex flex-col h-[600px] max-h-[80vh]">
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar">
                        {chatMessages.length === 0 && (
                            <div className="text-center py-10">
                                <div className="text-5xl mb-4">🤖</div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Bolla idéer med mig!</h3>
                                <p className="text-gray-500 dark:text-gray-400">Be mig sätta ihop ett snabbt underkroppspass, ge förslag på uppvärmning, eller strukturera dina egna anteckningar.</p>
                            </div>
                        )}
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none border border-gray-200 dark:border-gray-700'}`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                {msg.role === 'assistant' && (
                                    <div className="mt-2">
                                        <button 
                                            onClick={() => handleSaveFromChat(msg.content)}
                                            className="text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <PlusIcon className="w-3 h-3" /> Spara som anteckning
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-none p-4 w-16 flex justify-center border border-gray-200 dark:border-gray-700">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                            <input 
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="T.ex. Ge mig ett tungt underkroppspass..."
                                disabled={isChatLoading}
                                className="flex-grow bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                            />
                            <button 
                                type="submit"
                                disabled={!chatInput.trim() || isChatLoading}
                                className="bg-primary text-white p-3 rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                </svg>
                            </button>
                        </form>
                    </div>
                </div>
            </Modal>

            <WebCamCaptureModal 
                isOpen={isWebCamOpen} 
                onClose={() => setIsWebCamOpen(false)} 
                onCapture={(base64String) => {
                    setNewImagePreview(base64String);
                    setIsWebCamOpen(false);
                }} 
            />
        </div>
    );
};
