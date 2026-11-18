// CALDERA BAY — gta6-01 entrypoint (Node 22, standard library only).
// Hands the game in: copies this repository's game/ and screenshots/ to
// /output and writes /output/dossier.json with the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Screenshot integrity: the scorer refuses an entry with a missing or
// oversized screenshot, so check the set BEFORE copying anything — a bad
// screenshot fails fast here instead of leaving a partial /output behind.
const shotsDir = join(repoRoot, 'screenshots');
const shotFiles = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
  : [];
if (shotFiles.length !== 4) {
  throw new Error(`expected 4 screenshots in screenshots/, found ${shotFiles.length}`);
}
for (const f of shotFiles) {
  const bytes = statSync(join(shotsDir, f)).size;
  if (bytes > 262144) {
    throw new Error(`screenshot ${f} is ${bytes} bytes, over the 256 KiB cap`);
  }
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: text_max_bytes shapes the dossier text; the others refuse
// an entry the scorer would refuse (over 4 screenshots or one over 256 KiB;
// over 993 files in game/ or 48 MiB of game files; a game/ path over 1000 bytes).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Dossier read-back: the scorer requires dossier.json to equal what
// buildDossier writes from this very game/ and screenshots/, so verify the
// file we just wrote before the run is considered done — a truncated write
// or a hash mismatch fails here, loudly, instead of at grading time.
const dossierPath = join(outDir, 'dossier.json');
let dossier;
try {
  dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
} catch (err) {
  throw new Error(`dossier.json written to ${dossierPath} does not parse: ${(err as Error).message}`);
}
if (dossier.schema !== 'makefun/dossier/v1') {
  throw new Error(`dossier.json schema is ${String(dossier.schema)}, expected makefun/dossier/v1`);
}
if (dossier.cover !== 0) {
  throw new Error(`dossier.json cover is ${String(dossier.cover)}, expected 0 (the first screenshot by name)`);
}
if (!Array.isArray(dossier.images) || dossier.images.length !== 4) {
  throw new Error(`dossier.json holds ${Array.isArray(dossier.images) ? dossier.images.length : 'no'} images, expected 4`);
}
for (let i = 0; i < dossier.images.length; i++) {
  const image = dossier.images[i];
  if (image.name !== shotFiles[i]) {
    throw new Error(`dossier.json image ${i} is ${String(image.name)}, expected ${shotFiles[i]}`);
  }
  if (image.media_type !== 'image/jpeg' && image.media_type !== 'image/png') {
    throw new Error(`dossier.json image ${image.name} has media type ${String(image.media_type)}, expected image/jpeg or image/png`);
  }
  const copied = readFileSync(join(outDir, 'screenshots', image.name));
  const actual = createHash('sha256').update(copied).digest('hex');
  if (image.sha256 !== actual) {
    throw new Error(`dossier.json sha256 for ${image.name} does not match the copied screenshot`);
  }
  if (typeof image.base64 !== 'string' || image.base64.length === 0) {
    throw new Error(`dossier.json image ${image.name} has no base64 payload`);
  }
}
if (typeof dossier.text !== 'string' || !dossier.text.startsWith('## Game')) {
  throw new Error('dossier.json text does not start with the ## Game block');
}
if (!dossier.text.includes('### game/index.html')) {
  throw new Error('dossier.json text does not include the game/index.html source');
}
