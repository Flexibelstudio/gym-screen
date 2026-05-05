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

export const isBirthdayToday = (birthDateString?: string): boolean => {
    if (!birthDateString) return false;
    
    // birthDateString usually in format "YYYY-MM-DD"
    const parts = birthDateString.split('-');
    if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        const today = new Date();
        return today.getMonth() + 1 === month && today.getDate() === day;
    }
    
    return false;
};
