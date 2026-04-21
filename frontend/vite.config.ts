import path from 'path'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        tailwindcss(),
        react(),
        babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
        host: 'localhost',
        port: 8000,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:9000',
                changeOrigin: true,
            },
            '/media': {
                target: 'http://127.0.0.1:9000',
                changeOrigin: true,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/lib/api/core.ts', 'src/lib/utils.ts', 'src/lib/notify.ts'],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70,
            },
        },
    },
})
