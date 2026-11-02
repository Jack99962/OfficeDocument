import fs from 'node:fs';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import { workspaceSourceAliases } from './bin/workspace-aliases.mjs';
import { PAGES, generate as generatePages } from './bin/build-pages.mjs';
import { generate as generateLlmsFull } from './bin/llms-full.mjs';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// Resolve clean URLs to the static .html files under publicDir so the landing
// pages (e.g. /offline-document-editor, /zh-CN/open/docx) work in `pnpm dev`
// and `vite preview` exactly like on Cloudflare Pages in production, where
// extensionless URLs auto-resolve and /dir 308-redirects to /dir/. Without
// this the nav links 404 / no-op locally.
const cleanUrls = (publicDirName: string): Plugin => {
  const middlewareFor = (root: string) => {
    return (
      req: import('node:http').IncomingMessage,
      res: import('node:http').ServerResponse,
      next: () => void,
    ): void => {
      const [pathname, query] = (req.url ?? '/').split('?');
      if (pathname === '/' || pathname.includes('.')) return next();
      // Vite HTML entries at the project root (/editor -> editor.html) resolve
      // like the static pages under public/ do; Cloudflare Pages does the same.
      if (fs.existsSync(path.join(__dirname, `${pathname}.html`))) {
        req.url = `${pathname}.html${query ? `?${query}` : ''}`;
        return next();
      }
      if (!pathname.endsWith('/') && fs.existsSync(path.join(root, pathname, 'index.html'))) {
        // directory URL without slash: redirect like Cloudflare Pages does
        res.writeHead(308, { Location: `${pathname}/${query ? `?${query}` : ''}` });
        res.end();
        return;
      }
      const candidate = pathname.endsWith('/') ? `${pathname}index.html` : `${pathname}.html`;
      if (fs.existsSync(path.join(root, candidate))) req.url = candidate + (query ? `?${query}` : '');
      next();
    };
  };
  return {
    name: 'clean-urls',
    configureServer(server) {
      server.middlewares.use(middlewareFor(path.join(__dirname, publicDirName)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middlewareFor(path.join(__dirname, path.basename(server.config.build.outDir))));
    },
  };
};

// Vite's static handler returns 304 before applying configured headers.
// Set isolation policy before that handler so revalidated Worker responses
// retain the same policy as their initial 200 response (required by WebKit).
const localIsolationHeaders = (): Plugin => {
  const middleware = (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ): void => {
    if ((req.url ?? '').split('?')[0] === '/build-identity.json') res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  };
  return {
    name: 'local-isolation-headers',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};

// The x2t WASM is stored as Brotli bytes for HTTPS production hosting. Vite is
// commonly reached over ordinary HTTP on a LAN (`http://192.168.x.x:5173`),
// where serving that Brotli payload has produced a rejected fetch before x2t
// can instantiate. Serve a gzip representation in dev/preview, matching the
// Docker HTTP build, and raw WASM only for clients which do not accept gzip.
const BROTLI_ASSETS = ['/sdkjs/common/wasm/x2t/x2t.wasm.br'];

const precompressedAssets = (): Plugin => {
  let rawWasm: Buffer | null = null;
  let gzipWasm: Buffer | null = null;
  const middleware = (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
    next: () => void,
  ): void => {
    const pathname = (req.url ?? '/').split('?')[0];
    if (BROTLI_ASSETS.includes(pathname)) {
      rawWasm ??= brotliDecompressSync(
        fs.readFileSync(path.join(__dirname, 'public/sdkjs/common/wasm/x2t/x2t.wasm.br')),
      );
      const acceptsGzip = /(?:^|,|\s)gzip(?:,|\s|$)/i.test(String(req.headers['accept-encoding'] ?? ''));
      const body = acceptsGzip ? (gzipWasm ??= gzipSync(rawWasm, { level: 9 })) : rawWasm;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/wasm');
      res.setHeader('Content-Length', String(body.byteLength));
      res.setHeader('Cache-Control', 'no-cache');
      if (acceptsGzip) res.setHeader('Content-Encoding', 'gzip');
      if (req.method === 'HEAD') res.end();
      else res.end(body);
      return;
    }
    next();
  };
  return {
    name: 'precompressed-assets',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};

// Render the markdown-sourced pages (/help, /changelog, ... see
// bin/build-pages.mjs) into publicDir before Vite copies it. The outputs are
// gitignored: generating at build/dev time means a CHANGELOG or help edit
// can never leave a stale committed copy behind (two concurrently merged
// PRs used to be able to). Dev regenerates when a source markdown changes.
const generatedPages = (): Plugin => {
  const sources = new Set<string>();
  for (const page of PAGES) for (const src of Object.values(page.sources)) sources.add(path.resolve(__dirname, src));
  const run = () => {
    // The same legal notices must be available in dev, static hosting and Docker.
    for (const name of ['LICENSE', 'NOTICE']) {
      fs.copyFileSync(path.join(__dirname, name), path.join(__dirname, 'public', name));
    }
    const outputs = generatePages();
    // After the markdown pages: llms-full.txt is assembled from the rendered
    // pages, so /help and /changelog have to exist before it is written.
    generateLlmsFull();
    return outputs.length;
  };
  return {
    name: 'generated-pages',
    buildStart() {
      run();
    },
    configureServer(server) {
      run();
      for (const src of sources) server.watcher.add(src);
      server.watcher.on('change', (file) => {
        if (sources.has(path.resolve(file))) {
          run();
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
};

export default defineConfig(({ command }) => {
  const publicDirName = 'public';

  return {
    base: './',
    publicDir: publicDirName,
    server: {
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
    },
    preview: {
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
    },
    build: {
      outDir: 'dist',
      manifest: true,
      // Three HTML entries: / (static landing, no editor bundle), /editor (the
      // app) and /history (the local library, which reads IndexedDB metadata
      // and never loads the editor stack).
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          editor: resolve(__dirname, 'editor.html'),
          history: resolve(__dirname, 'history.html'),
        },
      },
    },
    plugins: [localIsolationHeaders(), generatedPages(), precompressedAssets(), cleanUrls(publicDirName)],
    resolve: {
      // One wildcard, matching tsconfig's `"@/*": ["./*"]`, so `@/lib/x`
      // resolves the same way for tsc and for the bundler. The five
      // directory-specific aliases that used to live here pointed at
      // `store/` and `assets/`, which do not exist in this repo.
      alias: [{ find: '@', replacement: __dirname }, ...(command === 'serve' ? workspaceSourceAliases(__dirname) : [])],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
  };
});
