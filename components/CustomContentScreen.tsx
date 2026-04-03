
import React, { useState } from 'react';
import { CustomPage } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    return (
        <div className={className}>
            <Markdown
                components={{
                    h1: ({node, ...props}) => <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-6 mt-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-10 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mt-6 mb-3" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed text-lg" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 pl-2 my-4 text-gray-700 dark:text-gray-300" {...props} />,
                    li: ({node, ...props}) => <li className="pl-2" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 py-2 my-6 italic text-lg text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-r-lg" {...props} />,
                    hr: ({node, ...props}) => <hr className="my-10 border-gray-200 dark:border-gray-700" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                    em: ({node, ...props}) => <em className="italic" {...props} />,
                }}
            >
                {content}
            </Markdown>
        </div>
    );
};


interface CustomContentScreenProps {
    page: CustomPage;
}

export const CustomContentScreen: React.FC<CustomContentScreenProps> = ({ page }) => {
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    if (!page || !page.tabs || page.tabs.length === 0) {
        return (
            <div className="w-full h-[50vh] flex items-center justify-center animate-fade-in">
                <p className="text-gray-400 text-xl">Denna sida saknar innehåll.</p>
            </div>
        );
    }
    
    const activeTab = page.tabs[activeTabIndex];

    return (
        <div className="w-full max-w-5xl mx-auto animate-fade-in pb-20">
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-2">{page.title}</h1>
                <div className="h-1 w-24 bg-primary mx-auto rounded-full"></div>
            </div>

            {/* Modern Tabs */}
            {page.tabs.length > 1 && (
                <div className="flex justify-center mb-10">
                    <div className="bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl inline-flex shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto max-w-full scrollbar-hide">
                        {page.tabs.map((tab, index) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabIndex(index)}
                                className={`
                                    px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap
                                    ${activeTabIndex === index
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md transform scale-105'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/30'
                                    }
                                `}
                            >
                                {tab.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Content Card */}
            <AnimatePresence mode="wait">
                {activeTab && (
                     <motion.div 
                        key={activeTab.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white dark:bg-gray-900/50 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800"
                     >
                        <MarkdownRenderer content={activeTab.content} className="max-w-none" />
                     </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
