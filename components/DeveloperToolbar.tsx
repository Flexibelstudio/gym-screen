import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

type SimulatedUserType = 'systemowner' | 'organizationadmin' | 'studio';

export const DeveloperToolbar: React.FC = () => {
    const { switchSimulatedUser, role, isStudioMode } = useAuth();

    // Kontrollera om vi är i en test/utvecklingsmiljö
    const isTestEnvironment = 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('aistudio.google.com') ||
        window.location.hostname.includes('googleusercontent.com') ||
        window.location.hostname.includes('stackblitz') ||
        window.location.hostname.includes('preview');

    // Visa endast om vi är i testmiljö OCH har funktionen tillgänglig
    if (!isTestEnvironment || !switchSimulatedUser) {
        return null; 
    }

    const handleSwitch = (userType: SimulatedUserType) => {
        switchSimulatedUser(userType);
    };

    const getButtonClass = (targetRole: UserRole | 'studio') => {
        let currentRole: UserRole | 'studio' = role;
        if (isStudioMode) {
            currentRole = 'studio';
        }
        
        return `w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
            currentRole === targetRole 
            ? 'bg-primary text-white font-bold' 
            : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
        }`;
    };

    return (
        <div className="fixed bottom-4 left-4 bg-gray-800/80 backdrop-blur-md rounded-lg shadow-2xl z-[9999] w-56 border border-gray-600 text-white p-3 font-sans">
            <h4 className="font-bold text-sm text-yellow-400 border-b border-gray-600 pb-2 mb-2">DEV TOOLBAR</h4>
            <p className="text-xs text-gray-400 mb-3">Simulera användarroll:</p>
            <div className="space-y-2">
                <button 
                    onClick={() => handleSwitch('systemowner')}
                    className={getButtonClass('systemowner')}
                >
                    Systemägare
                </button>
                <button 
                    onClick={() => handleSwitch('organizationadmin')}
                    className={getButtonClass('organizationadmin')}
                >
                    Org. Admin
                </button>
                <button 
                    onClick={() => handleSwitch('studio')}
                    className={getButtonClass('studio')}
                >
                    Studio-läge (Medlem)
                </button>
            </div>
        </div>
    );
};