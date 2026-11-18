import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('emojiData')) {
            return 'emoji-data';
          }
          if (id.includes('/js/settings/') || id.includes('\\js\\settings\\') || id.includes('settingsModal')) {
            return 'settings';
          }
          if (id.includes('/js/workspace/') || id.includes('\\js\\workspace\\')) {
            return 'workspace';
          }
          if (id.includes('/js/graph/') || id.includes('\\js\\graph\\')) {
            return 'graph';
          }
          if (id.includes('/js/board/') || id.includes('\\js\\board\\')) {
            return 'board';
          }
          if (id.includes('/js/share/') || id.includes('\\js\\share\\')) {
            return 'share';
          }
        }
      }
    }
  },
  server: {
    port: 3000
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js']
  }
});
