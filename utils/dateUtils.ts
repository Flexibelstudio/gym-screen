export const calculateAge = (birthDateString?: string, fallbackAge?: number | null): number | null => {
    if (!birthDateString) return fallbackAge || null;
    
    const today = new Date();
    const birthDate = new Date(birthDateString);
    
    if (isNaN(birthDate.getTime())) return fallbackAge || null;

    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
};

export const formatBirthday = (birthDateString?: string): string | null => {
    if (!birthDateString) return null;
    
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return null;

    const months = [
        'januari', 'februari', 'mars', 'april', 'maj', 'juni',
        'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    return `${birthDate.getDate()} ${months[birthDate.getMonth()]}`;
};
