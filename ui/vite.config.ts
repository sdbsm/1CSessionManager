import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false
            }
        }
      },
      plugins: [react()],
      // Build UI into .NET Control wwwroot so it can be served from one service/installer.
      // Note: UI will be available under /app/ path.
      base: '/app/',
      build: {
        // ui/ -> ../dotnet/...
        outDir: '../dotnet/src/1CSessionManager.Control/wwwroot/app',
        emptyOutDir: true,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
