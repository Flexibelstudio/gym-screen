
import { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Import a type from '../types' to ensure the file is processed and the global Spotify namespace is recognized.
import { SpotifyPlayerState } from '../types';
import { getSpotifyAuthUrl, saveSpotifyAuthData, clearSpotifyAuthData, getSpotifyAccessToken } from '../services/firebaseService';

// NOTE: This hook simulates the full OAuth 2.0 Authorization Code Flow,
// but uses localStorage for token management instead of a secure backend (Firebase Functions).
// This is a necessary simplification for a frontend-only implementation, but for a
// real production app, token management should be moved to the backend.

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const FAKE_REDIRECT_URI = window.location.origin; // Using origin for dev

export const useSpotifyPlayer = (studioId: string | null) => {
    const [player, setPlayer] = useState<Spotify.Player | null>(null);
    // FIX: Use the imported type alias for clarity and to fix namespace error.
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [hasAuth, setHasAuth] = useState(false);

    // This effect checks if we have a valid token on load.
    useEffect(() => {
        if (!studioId) return;

        const checkToken = async () => {
            const token = await getSpotifyAccessToken(studioId);
            setHasAuth(!!token);
        };
        checkToken();
    }, [studioId]);


    // This effect handles the Spotify redirect and initializes the player.
    useEffect(() => {
        if (!studioId) return;

        // --- 1. Handle OAuth Callback ---
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const state = params.get('state');
            const expiresIn = params.get('expires_in');
            
            // For security, ensure the state matches our studioId
            if (accessToken && state === studioId && expiresIn) {
                 saveSpotifyAuthData(studioId, accessToken, Number(expiresIn));
                 setHasAuth(true);
                 window.location.hash = ''; // Clear the hash from the URL
            }
        }
        
        // --- 2. Initialize Spotify SDK ---
        const initializePlayer = async () => {
             const token = await getSpotifyAccessToken(studioId);
             if (token && !(window as any).Spotify) {
                 // The SDK script is already in index.html. We just wait for it to be ready.
                 // This function is defined on the window object by the Spotify SDK script.
                (window as any).onSpotifyWebPlaybackSDKReady = () => {
                    const spotifyPlayer = new (window as any).Spotify.Player({
                        name: `Flexibel Hälsa - ${studioId}`,
                        getOAuthToken: (cb: (token: string) => void) => {
                            // This function MUST call the callback with a token, or an empty string if it fails.
                            getSpotifyAccessToken(studioId)
                                .then(token => {
                                    if (!token) {
                                        console.warn(`Spotify token not found or expired for studio ${studioId}. Auth may be required.`);
                                    }
                                    cb(token || ''); // Pass token or empty string
                                })
                                .catch(error => {
                                    console.error("Error fetching Spotify token for SDK:", error);
                                    cb(''); // Pass empty string on error
                                });
                        },
                        volume: 0.5
                    });
                    
                    spotifyPlayer.addListener('ready', ({ device_id }) => {
                        console.log('Spotify Player is ready', device_id);
                        setIsReady(true);
                    });

                    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                        console.log('Device ID has gone offline', device_id);
                        setIsReady(false);
                    });
                    
                    spotifyPlayer.addListener('player_state_changed', (state) => {
                        setPlayerState(state);
                    });
                    
                    spotifyPlayer.addListener('authentication_error', (e) => {
                        console.error('Authentication Error', e);
                        setHasAuth(false);
                        clearSpotifyAuthData(studioId);
                    });

                    spotifyPlayer.connect().catch(e => console.error("Spotify player failed to connect", e));
                    setPlayer(spotifyPlayer);
                };
             } else if(token && (window as any).Spotify && !player) {
                 // If SDK is ready but player not initialized, run the init logic again.
                 (window as any).onSpotifyWebPlaybackSDKReady();
             }
        };

        if (hasAuth) {
            initializePlayer().catch(err => {
                console.error("Error initializing Spotify player:", err);
            });
        }

        // Cleanup on unmount
        return () => {
            if (player) {
                player.disconnect();
            }
        };

    }, [studioId, hasAuth, player]);


    const login = useCallback(() => {
        if (!studioId || !SPOTIFY_CLIENT_ID) {
            console.error("Spotify Client ID is not configured.");
            return;
        }
        // In this simplified flow, we'll use the Implicit Grant flow which is less secure
        // but doesn't require a backend. A real app should use the getSpotifyAuthUrl function.
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(FAKE_REDIRECT_URI)}&scope=${encodeURIComponent(
            ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state'].join(' ')
        )}&response_type=token&state=${studioId}&show_dialog=true`;

        window.location.href = authUrl;
    }, [studioId]);
    
    const logout = useCallback(() => {
        if (!studioId) return;
        if (player) {
            player.disconnect();
        }
        setPlayer(null);
        setIsReady(false);
        setHasAuth(false);
        clearSpotifyAuthData(studioId);
    }, [studioId, player]);

    return { player, playerState, isSpotifyReady: isReady, hasSpotifyAuth: hasAuth, login, logout };
};