
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Exercise, BankExercise, Organization } from '../../types';
import { useStudio } from '../../context/StudioContext';
import { uploadImage, deleteImageByUrl, updateExerciseImageOverride } from '../../services/firebaseService';
import { resizeImage } from '../../utils/imageUtils';
import { DumbbellIcon } from '../icons';

interface ExerciseImageOverrideModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: Exercise | BankExercise | null;
    organization: Organization;
}

export const ExerciseImageOverrideModal: React.FC<ExerciseImageOverrideModalProps> = ({ isOpen, onClose, exercise, organization }) => {
    const { selectOrganization } = useStudio();
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [isOpen]);

    if (!isOpen || !exercise) return null;

    const getExerciseImageUrl = (ex: Exercise | BankExercise, org: Organization): string | undefined => {
        if (org.exerciseOverrides && org.exerciseOverrides[ex.id]) {
            return org.exerciseOverrides[ex.id].imageUrl;
        }
        return ex.imageUrl;
    };
    
    const currentImageUrl = getExerciseImageUrl(exercise, organization);
    const isOverridden = organization.exerciseOverrides?.[exercise.id] !== undefined;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        try {
            if (isOverridden && organization.exerciseOverrides?.[exercise.id]?.imageUrl) {
                await deleteImageByUrl(organization.exerciseOverrides[exercise.id].imageUrl);
            }
            
            const resizedBase64 = await resizeImage(file, 800, 800, 0.8);
            const path = `organizations/${organization.id}/exercise_images/${exercise.id}-${Date.now()}.jpg`;
            const downloadURL = await uploadImage(path, resizedBase64);

            const updatedOrg = await updateExerciseImageOverride(organization.id, exercise.id, downloadURL);
            selectOrganization(updatedOrg); 
            onClose();

        } catch (error) {
            console.error("Image override failed:", error);
            alert("Bilden kunde inte laddas upp. Försök igen.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReset = async () => {
        if (!isOverridden) return;

        setIsProcessing(true);
        try {
            const overrideUrl = organization.exerciseOverrides?.[exercise.id]?.imageUrl;
            if (overrideUrl) {
                await deleteImageByUrl(overrideUrl);
            }
            const updatedOrg = await updateExerciseImageOverride(organization.id, exercise.id, null);
            selectOrganization(updatedOrg);
            onClose();
        } catch (error) {
            console.error("Failed to reset image:", error);
            alert("Kunde inte återställa bilden.");
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1002] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 w-full max-w-md text-gray-900 dark:text-white shadow-2xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Anpassa bild för "{exercise.name}"</h2>
                <div className="my-4 relative w-full aspect-square bg-gray-200 dark:bg-black rounded-lg overflow-hidden">
                    {isProcessing && (
                         <div className="absolute inset-0 bg-gray-900/80 z-10 flex flex-col items-center justify-center gap-2">
                            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                            <p className="text-sm font-semibold text-gray-300">Bearbetar...</p>
                        </div>
                    )}
                    {currentImageUrl ? (
                        <img src={currentImageUrl} alt={exercise.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                           <DumbbellIcon className="w-16 h-16 text-gray-400 dark:text-gray-600"/>
                        </div>
                    )}
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                <div className="space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full bg-primary hover:brightness-95 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">Ladda upp ny bild</button>
                    {isOverridden && (
                        <button onClick={handleReset} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50">Återställ till standardbild</button>
                    )}
                    <button onClick={onClose} disabled={isProcessing} className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-lg transition-colors">Avbryt</button>
                </div>
            </div>
        </div>,
        document.body
    );
};
