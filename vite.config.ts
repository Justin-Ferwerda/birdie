import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Birdie for Shurdy 2026',
        short_name: 'Birdie',
        description:
          'Mobile-first disc golf scoring for the Birdie for Shurdy tournament.',
        theme_color: '#d4af37',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Don't aggressively cache Supabase API calls — we want fresh data
        // during the tournament. App shell still gets precached.
        navigateFallbackDenylist: [/^\/rest\//, /\.supabase\.co/],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
