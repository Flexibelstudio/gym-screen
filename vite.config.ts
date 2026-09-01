
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          devOptions: {
            enabled: false
          },
          registerType: 'autoUpdate',
          includeAssets: ['favicon.png', 'robots.txt', 'apple-touch-icon.png'],
          manifest: {
            name: 'SmartStudio',
            short_name: 'SmartStudio',
            description: 'SmartStudio - Din digitala träningspartner.',
            start_url: '/',
            display: 'standalone',
            // Installerad på hemskärmen ska appen aldrig vrida sig. Loggen är
            // byggd stående och bryts i liggande läge.
            orientation: 'portrait-primary',
            background_color: '#000000',
            theme_color: '#41c53c',
            icons: [
              {
                src: '/favicon.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/favicon.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: '/favicon.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 5000000,
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],
      define: {
        '__BYGGTID__': JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
        'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || ''),
        'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || ''),
        'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || ''),
        'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || ''),
        'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
        'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(process.env.VITE_FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('firebase')) {
                  return 'vendor-firebase';
                }
                if (id.includes('recharts') || id.includes('victory-vendor') || id.includes('d3-') || id.includes('react-smooth')) {
                  return 'vendor-charts';
                }
                if (id.includes('framer-motion')) {
                  return 'vendor-framer';
                }
                if (id.includes('lucide-react') || id.includes('@heroicons')) {
                  return 'vendor-icons';
                }
                if (id.includes('@dnd-kit')) {
                  return 'vendor-dnd';
                }
                if (id.includes('react-markdown') || id.includes('roughjs')) {
                  return 'vendor-ui-helpers';
                }
                // Catch-all: react, react-dom, scheduler och ALLA övriga småpaket
                // hamnar i EN gemensam vendor-chunk. Utan denna läcker t.ex.
                // scheduler (react-doms beroende) till index-chunken och skapar
                // en cirkulär laddkedja => "Cannot read properties of undefined
                // (reading 'forwardRef')" i vendor-charts vid sidladdning.
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
