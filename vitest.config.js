import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['test/frontend/**/*.test.js'],
        restoreMocks: true,
        clearMocks: true
    }
});
