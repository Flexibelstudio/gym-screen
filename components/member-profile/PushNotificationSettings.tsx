import React, { useState } from 'react';
import { requestPushNotificationPermission, auth } from '../../services/firebaseService';

export const PushNotificationSettings: React.FC = () => {
    const [isRequesting, setIsRequesting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');

    const handleEnablePush = async () => {
        if (!auth?.currentUser?.uid) return;
        setIsRequesting(true);
        setStatus('idle');
        try {
            const token = await requestPushNotificationPermission(auth.currentUser.uid);
            if (token) {
                setStatus('granted');
            } else {
                setStatus('denied');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-gray-800/50 p-6 rounded-2xl border border-slate-200 dark:border-gray-700 mt-2">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Push-notiser</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Aktivera push-notiser för att få uppdateringar och påminnelser direkt i din enhet.
            </p>
            
            <div className="flex items-center gap-4">
                <button 
                    onClick={handleEnablePush} 
                    disabled={isRequesting || status === 'granted'}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        status === 'granted' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-primary text-white hover:brightness-110'
                    } disabled:opacity-50`}
                >
                    {isRequesting ? 'Aktiverar...' : status === 'granted' ? 'Aktiverat' : 'Aktivera push-notiser'}
                </button>
                {status === 'denied' && <span className="text-sm text-red-500">Nekades av webbläsaren</span>}
                {status === 'error' && <span className="text-sm text-red-500">Ett fel uppstod</span>}
            </div>
        </div>
    );
};
