




import React from 'react';
import { CustomPage } from '../types';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    const renderMarkdown = () => {
        if (!content) {
            return { __html: '' };
        }

        const lines = content.split('\n');
        const htmlLines: string[] = [];
        let inList = false;

        const closeListIfNeeded = () => {
            if (inList) {
                htmlLines.push('</ul>');
                inList = false;
            }
        };

        for (const line of lines) {
            // Escape HTML characters for safety. This is a very basic sanitizer.
            let safeLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            // Apply inline formatting first
            safeLine = safeLine
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em>$1</em>');

            // Handle block elements
            if (line.startsWith('# ')) {
                closeListIfNeeded();
                htmlLines.push(`<h1 class="!text-3xl !font-extrabold !text-primary !mb-4">${safeLine.substring(2)}</h1>`);
            } else if (line.startsWith('## ')) {
                closeListIfNeeded();
                htmlLines.push(`<h2 class="!text-2xl !font-bold !text-gray-900 dark:!text-white !mt-8 !mb-3">${safeLine.substring(3)}</h2>`);
            } else if (line.startsWith('> ')) {
                closeListIfNeeded();
                htmlLines.push(`<blockquote class="!border-l-4 !border-primary !pl-4 !my-6 !italic !text-gray-500 dark:!text-gray-400"><p>${safeLine.substring(2)}</p></blockquote>`);
            } else if (line.trim() === '---') {
                closeListIfNeeded();
                htmlLines.push('<hr class="!my-8 !border-gray-200 dark:!border-gray-700" />');
            } else if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    htmlLines.push('<ul class="!list-disc !list-inside !space-y-2 !pl-4 !my-4">');
                    inList = true;
                }
                htmlLines.push(`<li>${safeLine.substring(2)}</li>`);
            } else {
                if (inList) {
                    htmlLines.push('</ul>');
                    inList = false;
                }
                if (line.trim() !== '') {
                    htmlLines.push(`<p class="!mb-4">${safeLine}</p>`);
                }
            }
        }

        if (inList) { // Close list if it's the last thing
            htmlLines.push('</ul>');
        }

        return { __html: htmlLines.join('\n') };
    };
    
    const defaultClasses = "prose prose-lg dark:prose-invert max-w-none text-gray-800 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800/50 p-6 sm:p-10 rounded-lg border border-gray-200 dark:border-gray-700/50";

    return (
        <div 
            className={className !== undefined ? className : defaultClasses}
            dangerouslySetInnerHTML={renderMarkdown()}
        />
    );
};


interface CustomContentScreenProps {
    page: CustomPage;
}

export const CustomContentScreen: React.FC<CustomContentScreenProps> = ({ page }) => {
    return (
        <div className="w-full max-w-3xl mx-auto animate-fade-in">
            <MarkdownRenderer content={page.content} />
        </div>
    );
};