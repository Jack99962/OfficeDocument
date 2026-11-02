import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GENERATED_ASSET = /^assets\/[A-Za-z0-9_.-]+\.(?:m?js|css|wasm|woff2)$/;

/** Follow edges within one capability; shared UI cycles never pull other engines in. */
function collectAssets(manifest, roots) {
  const visited = new Set();
  const assets = new Set();
  const add = (asset) => {
    if (!GENERATED_ASSET.test(asset)) throw new Error(`Unsupported offline asset: ${asset}`);
    assets.add(`/${asset}`);
  };
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Missing offline manifest dependency: ${key}`);
    for (const asset of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) add(asset);
    for (const imported of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(imported);
  };
  for (const root of roots) visit(root);
  return { assets, visited };
}

/** Core app dependencies install first. Optional features stay out of this graph. */
export async function stampOfflineAssets(directory) {
  const manifest = JSON.parse(await readFile(join(directory, '.vite', 'manifest.json'), 'utf8'));
  const entries = Object.entries(manifest)
    .filter(([, chunk]) => chunk.isEntry)
    .map(([key]) => key);
  if (!entries.length) throw new Error('Missing offline app entry');
  const { assets: core } = collectAssets(manifest, entries);
  const fonts = (await readdir(join(directory, 'ran-fonts'))).filter((name) => name.endsWith('.woff2'));
  for (const name of fonts) core.add(`/ran-fonts/${name}`);
  // Vite-only previews retain the stable token URL; production builds may
  // fingerprint it. Both shipped styles must work before any offline reload.
  for (const name of await readdir(directory))
    if (/^(?:ran-tokens(?:\.[A-Za-z0-9_-]+)?|app-tokens)\.css$/.test(name)) core.add(`/${name}`);
  if ((await readdir(join(directory, 'ran-fonts'))).includes('fonts.css')) core.add('/ran-fonts/fonts.css');
  const assets = [...core].sort();
  const path = join(directory, 'sw.js');
  const source = await readFile(path, 'utf8');
  const marker = 'const APP_ASSETS_TO_CACHE = []; // BUILD_APP_ASSETS';
  if (!source.includes(marker)) throw new Error('Missing offline asset build marker');
  await writeFile(
    path,
    source.replace(marker, `const APP_ASSETS_TO_CACHE = ${JSON.stringify(assets)}; // BUILD_APP_ASSETS`),
  );
  return assets;
}
if (process.argv[1]?.endsWith('/offline-assets.mjs')) await stampOfflineAssets(process.argv[2] ?? 'dist');
