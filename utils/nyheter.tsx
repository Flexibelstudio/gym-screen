import React from 'react';

// NY-markeringar: visas i 30 dagar fran lanseringsdatumet, sedan tysta de sjalva.
export const NYHETER = {
    program: '2026-09-03',
    infosidorLankar: '2026-09-03',
};

export const arNytt = (lanserat: string, dagar = 30): boolean =>
    Date.now() < new Date(lanserat + 'T00:00:00').getTime() + dagar * 24 * 60 * 60 * 1000;

export const NyMarke: React.FC<{ nar: string; className?: string }> = ({ nar, className = '' }) =>
    arNytt(nar) ? (
        <span className={`ml-2 px-1.5 py-0.5 rounded-md bg-primary text-white text-[9px] font-black tracking-widest align-middle ${className}`}>NY</span>
    ) : null;
