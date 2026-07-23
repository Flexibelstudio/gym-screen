import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AILoadingOverlayProps {
  isInterpreting: boolean;
  isResolving: boolean;
  isBeautifying: boolean;
}

export const AILoadingOverlay: React.FC<AILoadingOverlayProps> = ({
  isInterpreting,
  isResolving,
  isBeautifying
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [interpretingStep, setInterpretingStep] = useState<number>(0);

  useEffect(() => {
    if (isInterpreting) {
      setInterpretingStep(0);
      const timer = setTimeout(() => {
        setInterpretingStep(1);
      }, 3200);
      return () => clearTimeout(timer);
    }
  }, [isInterpreting]);

  if (!isInterpreting && !isResolving && !isBeautifying) {
    return null;
  }

  let title = '';
  let subtitle = '';
  let activeIndex = 0;

  if (isInterpreting) {
    if (interpretingStep === 0) {
      title = 'Läser din idé';
      subtitle = 'Analyserar skissen och tolkar dina övningar...';
      activeIndex = 0;
    } else {
      title = 'Bygger blocken';
      subtitle = 'Strukturerar repetitioner, set och tider...';
      activeIndex = 1;
    }
  } else if (isResolving) {
    title = 'Matchar mot övningsbanken';
    subtitle = 'Kollar din övningsbank och länkar rätt övningar...';
    activeIndex = 2;
  } else if (isBeautifying) {
    title = 'Snyggar till skissen';
    subtitle = 'Rensar linjer och formar en ren lektionsskiss...';
    activeIndex = 3;
  }

  const steps = [
    'Tolkning',
    'Struktur',
    'Bankmatchning',
    'Försnyggning'
  ];

  return (
    <div className="fixed inset-0 bg-gray-950/85 backdrop-blur-md flex flex-col items-center justify-center z-[9999] p-6 text-center select-none animate-fade-in">
      {/* Background ambient primary glow */}
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="relative z-10 max-w-md w-full bg-gray-900/90 border border-gray-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col items-center">
        {/* Animated AI orb / pulse icon */}
        <div className="relative mb-6 flex items-center justify-center">
          <motion.div
            className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/30 via-primary to-emerald-400 p-0.5 shadow-lg shadow-primary/30 flex items-center justify-center"
            animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full bg-gray-900 rounded-[0.9rem] flex items-center justify-center">
              <svg className="w-9 h-9 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* Dynamic Title */}
        <motion.h3
          key={title}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2"
        >
          {title}
        </motion.h3>

        {/* Dynamic Subtitle */}
        <motion.p
          key={subtitle}
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-400 font-medium mb-8 max-w-xs leading-relaxed"
        >
          {subtitle}
        </motion.p>

        {/* Subtle pulsing dots indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-primary"
              animate={prefersReducedMotion ? {} : {
                scale: [1, 1.4, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>

        {/* Step indicator bar */}
        <div className="w-full grid grid-cols-4 gap-1.5 pt-4 border-t border-gray-800/80">
          {steps.map((stepLabel, idx) => {
            const isPassed = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            return (
              <div key={stepLabel} className="flex flex-col items-center gap-1.5">
                <div className="w-full h-1.5 rounded-full overflow-hidden bg-gray-800">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isPassed
                        ? 'bg-primary'
                        : isCurrent
                        ? 'bg-primary/80 animate-pulse'
                        : 'bg-transparent'
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-bold tracking-tight truncate w-full text-center ${
                  isCurrent ? 'text-primary' : isPassed ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {stepLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
