import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                login: resolve(__dirname, 'src/subPages/login.html'),
                register: resolve(__dirname, 'src/subPages/register.html'),
                cwlPlanner: resolve(__dirname, 'src/subPages/cwl-planner.html'),
                cwlPlannerDrafts: resolve(__dirname, 'src/subPages/cwl-planner-drafts.html'),
                groups: resolve(__dirname, 'src/subPages/groups.html'),
                bracketGenerator: resolve(__dirname, 'src/subPages/bracket-generator.html')
            }
        }
    },
    server: {
        port: 5173,
        open: '/index.html'
    }
});
