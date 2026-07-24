import { useState, useEffect } from 'react';

export const useMinSplashTime = (): boolean => {
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return minSplashTimeElapsed;
};
