
export const useSpotifyPlayer = () => {
    // Spotify-funktionaliteten är borttagen.
    return {
        player: null,
        playerState: null,
        isReady: false,
        hasAuth: false,
        initiateAuth: () => {}
    };
};
