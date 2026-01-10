
import React from 'react';

export const EditableField: React.FC<{
    value: string;
    onChange: (value: string) => void;
    label: string;
    isTextarea?: boolean;
    isTitle?: boolean;
}> = ({ value, onChange, label, isTextarea, isTitle }) => {
    const commonClasses = "w-full bg-transparent focus:outline-none p-0";
    const textStyle = isTitle ? "text-3xl font-bold text-gray-900 dark:text-white" : "text-base text-gray-800 dark:text-gray-300";
    const wrapperClasses = isTitle ? "" : "bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-primary";
    
    const InputComponent = isTextarea ? 'textarea' : 'input';

    return (
        <div className={wrapperClasses}>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden">{label}</label>
            <InputComponent
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={label}
                className={`${commonClasses} ${textStyle}`}
                rows={isTextarea ? 3 : undefined}
            />
        </div>
    )
};
