import React, { useState } from 'react';
import { Organization, Location } from '../../types';
import { updateOrganizationLocations } from '../../services/firebaseService';
import { CopyIcon, QrCodeIcon, SparklesIcon } from '../icons';
import { Toast } from '../ui/ToastNotification';
import { PrintablePoster } from '../PrintablePoster';

interface LocationsContentProps {
    organization: Organization;
}

const generateInviteCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const LocationsContent: React.FC<LocationsContentProps> = ({ organization }) => {
    const [locations, setLocations] = useState<Location[]>(organization.locations || []);
    const [newLocationName, setNewLocationName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [toast, setToast] = useState<{message: string, visible: boolean}>({ message: '', visible: false });
    const [posterToPrint, setPosterToPrint] = useState<{type: 'member'|'coach', loc: Location} | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLocationName.trim()) return;

        setIsSaving(true);
        try {
            const newLocation: Location = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                name: newLocationName.trim(),
                createdAt: Date.now(),
                inviteCode: generateInviteCode(),
                coachCode: generateInviteCode()
            };
            const updatedLocations = [...locations, newLocation];
            await updateOrganizationLocations(organization.id, updatedLocations);
            setLocations(updatedLocations);
            setNewLocationName('');
            setToast({ message: "Ort tillagd!", visible: true });
        } catch (error) {
            console.error(error);
            alert("Kunde inte skapa ort.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (locationId: string, locationName: string) => {
        if (!window.confirm(`Är du säker på att du vill ta bort "${locationName}"? Medlemmar kopplade till denna ort kommer tappa kopplingen.`)) {
            return;
        }

        setIsSaving(true);
        try {
            const updatedLocations = locations.filter(loc => loc.id !== locationId);
            await updateOrganizationLocations(organization.id, updatedLocations);
            setLocations(updatedLocations);
            setToast({ message: "Ort borttagen!", visible: true });
        } catch(e) {
            console.error(e);
            alert("Kunde inte ta bort ort.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateMissingCodes = async (locId: string) => {
        setIsSaving(true);
        try {
            const updatedLocations = locations.map(loc => {
                if (loc.id === locId) {
                    return {
                        ...loc,
                        inviteCode: loc.inviteCode || generateInviteCode(),
                        coachCode: loc.coachCode || generateInviteCode()
                    };
                }
                return loc;
            });
            await updateOrganizationLocations(organization.id, updatedLocations);
            setLocations(updatedLocations);
            setToast({ message: "Koder genererade för orten!", visible: true });
        } catch (e) {
            console.error(e);
            alert("Kunde inte generera koder.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = (type: 'member'|'coach', loc: Location) => {
        setPosterToPrint({ type, loc });
        setTimeout(() => {
            window.print();
            setTimeout(() => setPosterToPrint(null), 1000);
        }, 300);
    };

    return (
         <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {toast.visible && <Toast message={toast.message} onClose={() => setToast({ ...toast, visible: false })} />}
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Studios / Orter</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lägg till orter för att generera unika QR-koder så att medlemmar registreras direkt på rätt ort.</p>
            </div>
            
             <div className="p-6 sm:p-8 space-y-6 bg-gray-50/50 dark:bg-gray-900/20">
                {locations.map(loc => (
                    <div key={loc.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                            <div className="flex items-center gap-4 flex-grow">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-xl border border-primary/20">
                                    {loc.name[0].toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-xl text-gray-900 dark:text-white">{loc.name}</p>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">
                                        Fristående Ort/Studio
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                                {(!loc.inviteCode || !loc.coachCode) ? (
                                    <button 
                                        onClick={() => handleGenerateMissingCodes(loc.id)} 
                                        disabled={isSaving} 
                                        className="flex items-center justify-center gap-2 bg-[#ffaa00]/10 hover:bg-[#ffaa00]/20 text-[#ffaa00] font-bold py-3 px-5 rounded-xl transition-colors border border-[#ffaa00]/20 w-full xl:w-auto"
                                    >
                                        <SparklesIcon className="w-5 h-5" /> Skapa inloggningskoder
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-3 w-full xl:w-auto">
                                        <div className="bg-black text-white p-3 rounded-lg border border-gray-700 flex flex-col justify-between items-center sm:items-start gap-2">
                                            <div className="w-full flex items-center justify-between text-xs text-gray-400 uppercase tracking-widest font-bold">
                                                Medlemskod för {loc.name}
                                                <span className="text-[#39ff14] text-sm bg-[#39ff14]/10 px-2 py-0.5 rounded ml-2">{loc.inviteCode}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-4 w-full mt-2 border-t border-gray-800 pt-3">
                                                 <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(loc.inviteCode || '');
                                                        setToast({ message: "Medlemskod kopierad!", visible: true });
                                                    }}
                                                    className="text-[10px] sm:text-xs font-black text-[#39ff14] hover:text-green-300 uppercase tracking-widest transition-colors flex items-center"
                                                >
                                                    <CopyIcon className="w-3 h-3 mr-2" /> Kopiera
                                                </button>
                                                <span className="text-gray-600">|</span>
                                                <button 
                                                    onClick={() => handlePrint('member', loc)}
                                                    className="text-[10px] sm:text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors flex items-center"
                                                >
                                                    <QrCodeIcon className="w-3 h-3 mr-2" /> Skriv ut poster
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-black text-white p-3 rounded-lg border border-purple-900/40 flex flex-col justify-between items-center sm:items-start gap-2 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-transparent pointer-events-none"></div>
                                            <div className="w-full flex items-center justify-between text-xs text-gray-400 uppercase tracking-widest font-bold relative z-10">
                                                Coachkod för {loc.name}
                                                <span className="text-[#bb86fc] text-sm bg-[#bb86fc]/10 px-2 py-0.5 rounded ml-2">{loc.coachCode}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-4 w-full mt-2 border-t border-purple-900/30 pt-3 relative z-10">
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(loc.coachCode || '');
                                                        setToast({ message: "Coachkod kopierad!", visible: true });
                                                    }}
                                                    className="text-[10px] sm:text-xs font-black text-[#bb86fc] hover:text-purple-300 uppercase tracking-widest transition-colors flex items-center"
                                                >
                                                    <CopyIcon className="w-3 h-3 mr-2" /> Kopiera
                                                </button>
                                                <span className="text-purple-900/50">|</span>
                                                <button 
                                                    onClick={() => handlePrint('coach', loc)}
                                                    className="text-[10px] sm:text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors flex items-center"
                                                >
                                                    <QrCodeIcon className="w-3 h-3 mr-2" /> Skriv ut poster
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-center w-full xl:w-auto xl:border-l xl:border-gray-200 xl:dark:border-gray-700 xl:pl-4 mt-2 xl:mt-0 pt-4 xl:pt-0 border-t border-gray-100 dark:border-gray-800 xl:border-t-0">
                                     <button onClick={() => handleDelete(loc.id, loc.name)} disabled={isSaving} className="text-xs uppercase tracking-wider font-bold text-gray-400 hover:text-red-500 transition-colors p-2">Ta bort ort</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {locations.length === 0 && (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm border-dashed">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-gray-700 text-gray-400">
                            <SparklesIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Inga studios/orter upplagda</h4>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Skapa din första ort nedan. När en ort skapas tilldelas den automatiskt inloggningskoder med tillhörande QR-koder.</p>
                    </div>
                )}
            </div>

             <div className="p-6 sm:p-8 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Lägg till ny studio/ort</h4>
                <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="Namn på ort/studio (t.ex. Stockholm, Gym 1)"
                        className="flex-grow bg-gray-50 dark:bg-gray-900 text-black dark:text-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:outline-none transition shadow-inner font-medium text-lg placeholder:text-gray-400 placeholder:font-normal"
                    />
                    <button type="submit" disabled={isSaving || !newLocationName.trim()} className="bg-primary hover:brightness-95 text-white font-bold py-4 px-10 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-95 text-lg whitespace-nowrap">
                        {isSaving ? 'Sparar...' : 'Spara ny studio'}
                    </button>
                </form>
            </div>

            {posterToPrint && (
                <PrintablePoster
                    title={posterToPrint.type === 'member' ? `Skapa konto för ${posterToPrint.loc.name}` : `Skapa coachkonto för ${posterToPrint.loc.name}`}
                    code={posterToPrint.type === 'member' ? (posterToPrint.loc.inviteCode || '') : (posterToPrint.loc.coachCode || '')}
                    url={`${window.location.origin}/?invite=${posterToPrint.type === 'member' ? posterToPrint.loc.inviteCode : posterToPrint.loc.coachCode}`}
                    organizationName={`${organization.name} - ${posterToPrint.loc.name}`}
                />
            )}
        </div>
    );
};
