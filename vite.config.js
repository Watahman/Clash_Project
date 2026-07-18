import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    root: 'src',
    envDir: '..',
    test: {
        root: '.',
        environment: 'jsdom',
        include: ['test/frontend/**/*.test.js'],
        restoreMocks: true,
        clearMocks: true
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                login: resolve(__dirname, 'src/subPages/login.html'),
                register: resolve(__dirname, 'src/subPages/register.html'),
                dashboard: resolve(__dirname, 'src/subPages/dashboard.html'),
                cwlPlanner: resolve(__dirname, 'src/subPages/cwl-planner.html'),
                cwlOperationBoard: resolve(__dirname, 'src/subPages/cwl-operation-board.html'),
                cwlPlannerDrafts: resolve(__dirname, 'src/subPages/cwl-planner-drafts.html'),
                groups: resolve(__dirname, 'src/subPages/groups.html'),
                bracketGenerator: resolve(__dirname, 'src/subPages/bracket-generator.html'),
                profilePopup: resolve(__dirname, 'src/subPages/popup_HTMLs/profile_popup.html')
            }
        }
    },
    server: {
        port: 5173,
        open: '/index.html',
        proxy: {
            '/api': {
                target: process.env.VITE_DEV_API_TARGET || 'http://localhost:8080',
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, '')
            }
        }
    }
});
