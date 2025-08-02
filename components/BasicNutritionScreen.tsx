import React from 'react';
import { basicNutritionData } from '../data/basicNutritionData';

export const BasicNutritionScreen: React.FC = () => {
    return (
        <div className="w-full max-w-3xl mx-auto animate-fade-in bg-gray-100 dark:bg-gray-800/50 rounded-lg p-6 sm:p-10 border border-gray-200 dark:border-gray-700/50">
            <div className="space-y-10">
                {basicNutritionData.map((section, index) => (
                    <div key={index}>
                        <h2 className="text-3xl font-extrabold text-primary mb-4">{section.title}</h2>
                        <div className="space-y-4">
                            {section.content.map((item, itemIndex) => {
                                if (item.type === 'callout') {
                                    return (
                                        <div key={itemIndex} className="p-5 my-6 bg-gray-200 dark:bg-gray-900 border-l-4 border-primary rounded-r-lg">
                                            <p className="text-lg font-semibold text-gray-800 dark:text-white">
                                                {item.text}
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <p key={itemIndex} className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {item.text}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};