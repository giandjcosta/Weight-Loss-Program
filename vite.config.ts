import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// `base` matches the eventual GitHub Pages subpath. No deploy is configured here.
export default defineConfig({
  base: '/Weight-Loss-Program/',
  plugins: [preact()],
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
