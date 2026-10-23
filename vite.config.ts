import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vite plugin that copies the public/ directory (manifest.json, icons)
 * into the build output so the result is a loadable unpacked extension.
 */
function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      const publicDir = path.resolve(__dirname, 'public');
      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(publicDir)) return;

      function copyDir(src: string, dest: string) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const s = path.join(src, entry.name);
          const d = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(s, d);
          } else {
            fs.copyFileSync(s, d);
          }
        }
      }

      copyDir(publicDir, outDir);

      // Vite emits the side panel HTML under src/sidepanel/index.html; the
      // manifest expects it at sidepanel/index.html. Normalize the layout so
      // the extension is loadable straight out of dist/.
      const srcHtml = path.join(outDir, 'src', 'sidepanel', 'index.html');
      const outHtml = path.join(outDir, 'sidepanel', 'index.html');
      if (fs.existsSync(srcHtml)) {
        fs.mkdirSync(path.dirname(outHtml), { recursive: true });
        fs.renameSync(srcHtml, outHtml);
        try {
          fs.rmdirSync(path.join(outDir, 'src', 'sidepanel'));
          fs.rmdirSync(path.join(outDir, 'src'));
        } catch {
          // ignore non-empty dirs
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionAssets()],
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Multiple entry points: side panel HTML page and background service worker.
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, 'src/sidepanel/index.html'),
        background: path.resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk: { name: string }) =>
          chunk.name === 'background'
            ? 'background/service-worker.js'
            : 'sidepanel/assets/[name]-[hash].js',
        chunkFileNames: 'sidepanel/assets/[name]-[hash].js',
        assetFileNames: 'sidepanel/assets/[name]-[hash].[ext]',
      },
    },
  },
});
