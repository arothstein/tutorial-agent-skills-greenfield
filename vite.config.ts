import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the built page works when served from a subpath,
  // not just a domain root.
  base: './',
  build: {
    target: 'es2022',
  },
});
