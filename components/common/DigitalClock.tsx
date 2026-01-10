
import React, { useState, useEffect } from 'react';

const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

export const DigitalClock: React.FC = () => {
    const [time, setTime] = useState(formatTime(new Date()));
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timerId = setInterval(() => {
            setTime(formatTime(new Date()));
        }, 1000); 

        return () => {
            clearInterval(timerId);
        };
    }, []);
    
    return (
        <div 
            className="font-mono text-3xl font-bold cursor-pointer transition-all duration-300 flex items-center justify-center text-black dark:text-white"
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? "Dölj klockan" : "Visa klockan"}
            style={{ 
                minWidth: '95px', 
                minHeight: '62px',
             }} 
        >
            {isVisible ? (
                <span>{time}</span>
            ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )}
        </div>
    );
};
