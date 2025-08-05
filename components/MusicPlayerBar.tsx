import React, { useState, useEffect, useCallback } from 'react';
import { SpotifyPlayerState, SpotifyDevice } from '../types';
import { getSpotifyAccessToken } from '../services/firebaseService';

// --- Icon Components ---
const PlayIcon = () => (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 5.083A1.5 1.5 0 0 1 7.72 4.01l7.994 4.917a1.5 1.5 0 0 1 0 2.146L7.72 15.99A1.5 1.5 0 0 1 5.5 14.917V5.083Z"/></svg>
);

const PauseIcon = () => (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5zM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5z"/></svg>
);

const PreviousTrackIcon = () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M15.023 18.003a.75.75 0 0 1-.75-.75V2.748a.75.75 0 0 1 1.5 0V17.25a.75.75 0 0 1-.75.753ZM5.474 12.333a.75.75 0 0 1 0-1.333l6-3.467a.75.75 0 0 1 1.276.666v6.934a.75.75 0 0 1-1.276.667l-6-3.467Z"/></svg>
);

const NextTrackIcon = () => (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4.977 18.003a.75.75 0 0 0 .75-.75V2.748a.75.75 0 0 0-1.5 0V17.25a.75.75 0 0 0 .75.753ZM14.526 12.333a.75.75 0 0 0 0-1.333l-6-3.467a.75.75 0 0 0-1.276.666v6.934a.75.75 0 0 0 1.276.667l6-3.467Z"/></svg>
);

const MusicNoteIcon = () => (
    <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 0 0-1.196-.98l-10 2A1 1 0 0 0 6 5v9.114A4.369 4.369 0 0 0 5 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6v5.894A4.369 4.369 0 0 0 15 12c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V3Z"/></svg>
);
// --- End Icon Components ---


interface MusicPlayerBarProps {
    player: Spotify.Player;
    playerState: SpotifyPlayerState | null;
    studioId: string;
}

export const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({ player, playerState, studioId }) => {
    const [volume, setVolume] = useState(0.5);
    const [devices, setDevices] = useState<SpotifyDevice[]>([]);
    const [activeDevice, setActiveDevice] = useState<string | null>(null);

    const callSpotifyApi = useCallback(async (endpoint: string, options: RequestInit = {}) => {
        const token = await getSpotifyAccessToken(studioId);
        if (!token) {
            console.error("No Spotify token available.");
            return null;
        }
        const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`Spotify API error for ${endpoint}: ${response.statusText}`);
            return null;
        }
        // Handle cases where there is no response body
        if (response.status === 204) {
            return true;
        }
        return response.json();
    }, [studioId]);


    const getDevices = useCallback(async () => {
        const data = await callSpotifyApi('me/player/devices');
        if (data && data.devices) {
            setDevices(data.devices);
            const currentActive = data.devices.find((d: SpotifyDevice) => d.is_active);
            if(currentActive) setActiveDevice(currentActive.id);
        }
    }, [callSpotifyApi]);
    
    useEffect(() => {
        getDevices();
    }, [getDevices]);

    useEffect(() => {
        if(player) {
            player.getVolume().then(vol => setVolume(vol));
        }
    }, [player]);
    
    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        player.setVolume(newVolume);
    };

    const transferPlayback = async (deviceId: string) => {
        await callSpotifyApi('me/player', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [deviceId], play: true })
        });
        setActiveDevice(deviceId);
    };

    const current_track = playerState?.track_window?.current_track;

    // A more robust check. If there's no state or no track in the window, show a generic message.
    if (!current_track) {
        return (
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-gray-900/80 dark:bg-black/80 backdrop-blur-md flex items-center justify-center text-gray-400 z-50 border-t border-gray-700/50">
                Starta uppspelning för att styra musiken härifrån.
            </div>
        )
    }

    const imageUrl = current_track.album?.images?.[0]?.url;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/80 dark:bg-black/80 backdrop-blur-md text-white z-50 border-t border-gray-700/50">
            <div className="max-w-6xl mx-auto p-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    {imageUrl ? (
                        <img src={imageUrl} alt={current_track.name} className="w-14 h-14 rounded-md shadow-lg" />
                    ) : (
                        <div className="w-14 h-14 rounded-md shadow-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <MusicNoteIcon />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-bold truncate">{current_track.name}</p>
                        <p className="text-sm text-gray-400 truncate">{current_track.artists.map(a => a.name).join(', ')}</p>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                        <button onClick={() => player.previousTrack()} className="hover:text-primary transition-colors">
                            <PreviousTrackIcon />
                        </button>
                        <button onClick={() => player.togglePlay()} className="bg-primary rounded-full p-2 hover:brightness-110 transition-all">
                            {playerState?.paused ? <PlayIcon/> : <PauseIcon />}
                        </button>
                        <button onClick={() => player.nextTrack()} className="hover:text-primary transition-colors">
                           <NextTrackIcon />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-4">
                     <div className="group relative">
                        <button onClick={getDevices} className="hover:text-primary transition-colors">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M1 3.25A2.25 2.25 0 0 1 3.25 1h13.5A2.25 2.25 0 0 1 19 3.25v13.5A2.25 2.25 0 0 1 16.75 19H3.25A2.25 2.25 0 0 1 1 16.75V3.25ZM3.25 2.5a.75.75 0 0 0-.75.75v13.5c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75V3.25a.75.75 0 0 0-.75-.75H3.25Z"/><path d="M6 14.75A1.25 1.25 0 1 0 6 12a1.25 1.25 0 0 0 0 2.75Zm0-1.5a.25.25 0 1 1 0 .5.25.25 0 0 1 0-.5Z"/></svg>
                        </button>
                        <div className="absolute bottom-full right-0 mb-2 w-64 bg-gray-800 rounded-lg shadow-lg p-2 hidden group-hover:block">
                            {devices.map(device => (
                                <button key={device.id} onClick={() => transferPlayback(device.id!)} className={`w-full text-left px-3 py-2 rounded-md transition-colors ${device.id === activeDevice ? 'bg-primary text-white' : 'hover:bg-gray-700'}`}>
                                    {device.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
};