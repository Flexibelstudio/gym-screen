import { useState, useEffect } from 'react';
import { listenToForegroundMessages } from '../../services/firebaseService';

export interface PushToastState {
  message: string;
  isVisible: boolean;
}

export const usePushToast = (isOffline: boolean) => {
  const [pushToast, setPushToast] = useState<PushToastState>({ message: '', isVisible: false });

  // Push notification foreground listener
  useEffect(() => {
    if (isOffline) return;
    const unsubscribe = listenToForegroundMessages((payload) => {
      const title = payload.notification?.title || 'Ny notis';
      const body = payload.notification?.body || '';
      setPushToast({ message: `${title}: ${body}`, isVisible: true });
    });
    return () => unsubscribe();
  }, [isOffline]);

  return { pushToast, setPushToast };
};
