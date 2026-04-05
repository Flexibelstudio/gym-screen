importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkdGj5XOkTdpfhSpcvO_TwDTjy204qTq0",
  authDomain: "gym-screen.firebaseapp.com",
  projectId: "gym-screen",
  storageBucket: "gym-screen.firebasestorage.app",
  messagingSenderId: "970379052933",
  appId: "1:970379052933:web:0756911ee508d5c8c1a6ec"
};

firebase.initializeApp(FIREBASE_CONFIG);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'SmartStudio';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/favicon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
