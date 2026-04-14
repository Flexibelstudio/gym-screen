import React, { useState, useEffect, useRef } from 'react';
import { GalleryImage } from '../../types';
import { getGalleryImages, addGalleryImage, removeGalleryImage } from '../../services/firebaseService';
import { TrashIcon, PlusIcon } from '../icons';

export const GalleryManagementTab: React.FC = () => {
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [gymName, setGymName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        setIsLoading(true);
        const data = await getGalleryImages();
        setImages(data);
        setIsLoading(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const newImage = await addGalleryImage(file, gymName);
        if (newImage) {
            setImages([newImage, ...images]);
            setGymName('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
            alert("Ett fel uppstod vid uppladdning av bilden.");
        }
        setIsUploading(false);
    };

    const handleDelete = async (id: string, imageUrl: string) => {
        if (window.confirm("Är du säker på att du vill ta bort denna bild?")) {
            await removeGalleryImage(id, imageUrl);
            setImages(images.filter(img => img.id !== id));
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Kundgalleri (Landningssida)</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Ladda upp bilder från studios som använder plattformen. Dessa visas i en rullande karusell på landningssidan. Rekommenderat format är kvadratiskt (1:1).
            </p>

            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-8 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lägg till ny bild</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-grow w-full">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gymmets namn (frivilligt)</label>
                        <input
                            type="text"
                            value={gymName}
                            onChange={(e) => setGymName(e.target.value)}
                            placeholder="T.ex. CrossFit Svea"
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            id="gallery-upload"
                        />
                        <label
                            htmlFor="gallery-upload"
                            className={`cursor-pointer flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-colors ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
                        >
                            {isUploading ? 'Laddar upp...' : <><PlusIcon /> Välj bild</>}
                        </label>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-8 text-gray-500">Laddar bilder...</div>
            ) : images.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Inga bilder uppladdade ännu.</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {images.map(img => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 aspect-square bg-gray-100 dark:bg-gray-900">
                            <img src={img.imageUrl} alt={img.gymName || 'Gym'} className="w-full h-full object-cover" />
                            {img.gymName && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                                    {img.gymName}
                                </div>
                            )}
                            <button
                                onClick={() => handleDelete(img.id, img.imageUrl)}
                                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                title="Ta bort bild"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
