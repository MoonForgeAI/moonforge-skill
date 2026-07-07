// Bundle the ES-module SDK into a single browser IIFE for legacy <script> games.
import { build } from 'esbuild';

const DIR = 'skills/moonforge-implement/assets/moonforge-sdk';

await build({
  entryPoints: [`${DIR}/index.js`],
  outfile: `${DIR}/moonforge.global.js`,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2019'],
  legalComments: 'none',
  banner: { js: '/* MoonForge Web SDK — generated global bundle. Do not edit by hand. Regenerate with: npm run build:sdk */' },
});

console.log(`Wrote ${DIR}/moonforge.global.js`);
