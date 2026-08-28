import React, { useEffect } from 'react';

/**
 * Appen ska se likadan ut oavsett hur telefonen hålls.
 *
 * Installerad på hemskärmen sköter manifestet det. I en vanlig flik finns
 * ingen spärr att sätta — iOS låter ingen webbsida hindra att skärmen vrids.
 * Därför gör vi tvärtom: när telefonen vrids roterar vi appen lika mycket
 * tillbaka, så att den följer med telefonens kropp. För den som håller i
 * mobilen ser det ut som att ingenting hände.
 *
 * Komponenten ritar ingenting. Den sätter en klass på html-elementet och
 * lämnar över till CSS:en i index.css.
 */

/** Bara telefoner. Surfplattor och datorer ska aldrig roteras. */
const isPhoneScreen = (): boolean => {
    if (typeof window === 'undefined') return false;
    return Math.min(window.screen.width, window.screen.height) <= 500;
};

type Rotation = 'none' | 'cw' | 'ccw';

/**
 * screen.orientation.angle är den exakta mätningen, men den rapporterar noll i
 * lägen där telefonen faktiskt ligger ner. Därför mäter vi även fönstret: i
 * liggande läge är en telefon bredare än 500 pixlar. Ett uppfällt tangentbord i
 * stående läge gör fönstret lägre än det är brett, men bredden stannar under
 * 500 — så den fällan undviks.
 */
const readRotation = (): Rotation => {
    if (typeof window === 'undefined') return 'none';

    const angle = (window.screen as any)?.orientation?.angle;
    if (angle === 90) return 'ccw';
    if (angle === 270) return 'cw';

    const legacy = (window as any).orientation;
    if (legacy === 90) return 'ccw';
    if (legacy === -90) return 'cw';

    // Vinkeln teg men fönstret säger liggande. Vi vet inte åt vilket håll,
    // och tar då det vanligaste.
    if (window.innerWidth > window.innerHeight && window.innerWidth > 500) return 'ccw';

    return 'none';
};

export const PortraitLock: React.FC = () => {
    useEffect(() => {
        const root = document.documentElement;

        const apply = () => {
            const rotation = isPhoneScreen() ? readRotation() : 'none';

            if (rotation === 'none') {
                root.classList.remove('force-portrait');
                root.removeAttribute('data-portrait-rotate');
                root.style.removeProperty('--pl-w');
                root.style.removeProperty('--pl-h');
                return;
            }

            // Exakta pixlar, inte vh och vw. På iOS räknar vh in adressfältet
            // och då hamnar appen en bit utanför skärmen.
            root.style.setProperty('--pl-w', `${window.innerWidth}px`);
            root.style.setProperty('--pl-h', `${window.innerHeight}px`);
            root.setAttribute('data-portrait-rotate', rotation);
            root.classList.add('force-portrait');
        };

        apply();

        // Måtten är rätt först när webbläsaren hunnit lägga om fönstret.
        const applySoon = () => { apply(); window.setTimeout(apply, 250); };

        const orientation = (window.screen as any)?.orientation;
        orientation?.addEventListener?.('change', applySoon);
        window.addEventListener('orientationchange', applySoon);
        window.addEventListener('resize', apply);

        return () => {
            orientation?.removeEventListener?.('change', applySoon);
            window.removeEventListener('orientationchange', applySoon);
            window.removeEventListener('resize', apply);
            root.classList.remove('force-portrait');
            root.removeAttribute('data-portrait-rotate');
            root.style.removeProperty('--pl-w');
            root.style.removeProperty('--pl-h');
        };
    }, []);

    return null;
};
