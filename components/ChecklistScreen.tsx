import React from 'react';
import { checklistData, checklistFooter } from '../data/checklistData';

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);


export const ChecklistScreen: React.FC = () => {
    return (
        <div className="w-full max-w-3xl mx-auto animate-fade-in bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 sm:p-10 border border-gray-200 dark:border-gray-700/50">
            <div className="space-y-8">
                {checklistData.map((section, index) => (
                    <div key={index}>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 mb-4 border-b-2 border-gray-300 dark:border-gray-700">{section.title}</h2>
                        <ul className="space-y-4">
                            {section.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="flex items-start gap-4">
                                    <CheckIcon />
                                    <span className={`text-lg ${item.highlighted ? 'text-primary font-semibold' : 'text-gray-700 dark:text-gray-300'}`}>
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                
                <div className="pt-8 text-center">
                    <p className="text-4xl font-extrabold text-primary tracking-wider uppercase">
                        {checklistFooter}
                    </p>
                </div>
            </div>
        </div>
    );
};