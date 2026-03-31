export type JokerType = 'reward' | 'challenge';

export interface JokerEvent {
    id: string;
    type: JokerType;
    title: string;
    description: string;
    duration?: number; // in seconds
}

export const JOKER_EVENTS: JokerEvent[] = [
    // Rewards
    { id: 'r1', type: 'reward', title: 'Vattenpaus!', description: 'Drick vatten och hämta andan.', duration: 30 },
    { id: 'r2', type: 'reward', title: 'Vila!', description: 'Skaka loss armar och ben.', duration: 60 },
    { id: 'r3', type: 'reward', title: 'Valfri övning!', description: 'Gruppen väljer en valfri (och rolig!) övning.' },
    { id: 'r4', type: 'reward', title: 'High-five paus!', description: 'Ge alla i rummet en high-five!', duration: 15 },
    { id: 'r5', type: 'reward', title: 'Stretcha!', description: 'Stretcha ut ordentligt.', duration: 45 },
    { id: 'r6', type: 'reward', title: 'Slipp nästa!', description: 'Ni slipper nästa kort/snurr. Gå vidare direkt!' },
    
    // Challenges
    { id: 'c1', type: 'challenge', title: 'Puls-spurt!', description: 'Alla gör 10 burpees direkt!' },
    { id: 'c2', type: 'challenge', title: 'Jägarvila!', description: 'Hitta en vägg och sitt i 90 grader.', duration: 60 },
    { id: 'c3', type: 'challenge', title: 'Dubbelt upp!', description: 'Dubbla antalet repetitioner på nästa övning!' },
    { id: 'c4', type: 'challenge', title: 'Plankan!', description: 'Alla ner i plankan.', duration: 60 },
    { id: 'c5', type: 'challenge', title: 'Idioten!', description: 'Spring fram och tillbaka i rummet.', duration: 45 },
    { id: 'c6', type: 'challenge', title: 'Upphopp!', description: 'Gör 15 explosiva upphopp tillsammans.' },
];

export const getRandomJoker = (type: 'reward' | 'challenge' | 'mixed'): JokerEvent => {
    const available = JOKER_EVENTS.filter(j => type === 'mixed' || j.type === type);
    return available[Math.floor(Math.random() * available.length)];
};
