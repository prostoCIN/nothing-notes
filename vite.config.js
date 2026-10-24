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
          if (id.includes('/js/graph/') || id.includes('\\js\\graph\\')) {
            return 'graph';
          }
          if (id.includes('/js/board/') || id.includes('\\js\\board\\')) {
            return 'board';
          }
          if (id.includes('/js/sync/') || id.includes('\\js\\sync\\') || id.includes('cloudSync.js')) {
            return 'sync';
          }
          if (id.includes('/js/share/') || id.includes('\\js\\share\\') || id.includes('shareManager.js')) {
            return 'share';
          }
          if (id.includes('settingsModal.js') || id.includes('/js/settings/') || id.includes('\\js\\settings\\') || id.includes('authModal.js') || id.includes('accountManager.js')) {
            return 'modals';
          }
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
