import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // In dev mode, use root path for easier development
    // In build mode, use /app/ path for production deployment
    const isDev = mode === 'development';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:5095',
                changeOrigin: false, // Keep origin to preserve localhost detection
                secure: false,
                configure: (proxy, options) => {
                    proxy.on('proxyReq', (proxyReq, req, res) => {
                        // Ensure localhost is preserved for API key middleware
                        proxyReq.setHeader('X-Forwarded-For', '127.0.0.1');
                        proxyReq.setHeader('X-Real-IP', '127.0.0.1');
                    });
                }
            }
        }
      },
      plugins: [react()],
      // Build UI into .NET Control wwwroot so it can be served from one service/installer.
      // Note: UI will be available under /app/ path in production.
      base: isDev ? '/' : '/app/',
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
