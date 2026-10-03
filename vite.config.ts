import { defineConfig } from 'vite';

// GitHub Pages sert le site sous /MathProtector2/ ; en dev on reste à la racine.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/MathProtector2/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
}));
