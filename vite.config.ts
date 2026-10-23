import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BACKEND_URL = 'http://localhost:8000';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Validate and normalise the backend origin used at build time.
 *
 * SECURITY: the origin is written into host_permissions and the extension CSP,
 * so wildcards, paths, credentials, and insecure non-loopback URLs are rejected
 * rather than silently weakening the manifest.
 */
function resolveBackendUrl(rawValue: string | undefined): string {
  const raw = (rawValue ?? '').trim() || DEFAULT_BACKEND_URL;

  if (raw.includes('*')) {
    throw new Error('BHARATVOICE_BACKEND_URL must not contain a wildcard.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `BHARATVOICE_BACKEND_URL must be an absolute origin such as https://api.example.com (received ${JSON.stringify(raw)}).`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('BHARATVOICE_BACKEND_URL must use http:// or https://.');
  }
  if (url.username || url.password) {
    throw new Error('BHARATVOICE_BACKEND_URL must not include credentials.');
  }
  if (url.search || url.hash) {
    throw new Error('BHARATVOICE_BACKEND_URL must not include a query string or fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('BHARATVOICE_BACKEND_URL must be an origin only, without a path.');
  }
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(
      'Plain HTTP is allowed only for localhost. Use HTTPS for a deployed backend.'
    );
  }

  return url.origin;
}

/**
 * Normalise the side-panel HTML path and rewrite the copied manifest so it only
 * grants access to the configured backend origin.
 */
function prepareExtension(backendUrl: string) {
  return {
    name: 'bharatvoice-extension-assets',
    apply: 'build' as const,
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');

      // Vite emits the side panel HTML under src/sidepanel/index.html; the
      // manifest expects it at sidepanel/index.html.
      const srcHtml = path.join(outDir, 'src', 'sidepanel', 'index.html');
      const outHtml = path.join(outDir, 'sidepanel', 'index.html');
      if (fs.existsSync(srcHtml)) {
        fs.mkdirSync(path.dirname(outHtml), { recursive: true });
        fs.renameSync(srcHtml, outHtml);
        try {
          fs.rmdirSync(path.join(outDir, 'src', 'sidepanel'));
          fs.rmdirSync(path.join(outDir, 'src'));
        } catch {
          // Non-empty or already removed: leave the remaining directory alone.
        }
      } else if (!fs.existsSync(outHtml)) {
        throw new Error(
          'Build did not produce sidepanel/index.html; check the Vite input paths.'
        );
      }

      const manifestPath = path.join(outDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Build did not produce dist/manifest.json.');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        host_permissions?: string[];
        content_security_policy?: { extension_pages?: string };
      };

      manifest.host_permissions = [`${backendUrl}/*`];

      const currentCsp =
        manifest.content_security_policy?.extension_pages ??
        "script-src 'self'; object-src 'self'";
      const directives = currentCsp
        .split(';')
        .map((directive: string) => directive.trim())
        .filter(Boolean)
        .filter((directive: string) => !directive.toLowerCase().startsWith('connect-src'));
      manifest.content_security_policy = {
        ...manifest.content_security_policy,
        extension_pages: `${directives.join('; ')}; connect-src 'self' ${backendUrl}`,
      };

      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    },
  };
}

export default defineConfig(({ mode }) => {
  // Read .env files plus real process environment. Explicit process variables
  // win so CI can override a developer's local .env.
  const fileEnv = loadEnv(mode, __dirname, '');
  const backendUrl = resolveBackendUrl(
    process.env.BHARATVOICE_BACKEND_URL ??
      process.env.VITE_BACKEND_URL ??
      fileEnv.BHARATVOICE_BACKEND_URL ??
      fileEnv.VITE_BACKEND_URL
  );

  return {
    plugins: [react(), prepareExtension(backendUrl)],
    define: {
      __BACKEND_URL__: JSON.stringify(backendUrl),
    },
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
  };
});
