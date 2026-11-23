// Hands in "Sunburn: Port Solera" (Node 22, standard library only).
// The game lives in game/ as plain static files: index.html loads src/main.js and its ES modules,
// with no library, no build step and no network request. This program copies game/ and the
// screenshots into the output directory and writes the dossier the judge reads.
//
// Play locally:   node serve.ts   then open http://localhost:8080
// Hand in here:   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Limits the gate enforces; buildDossier refuses an entry that breaks them. */
const LIMITS = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyFolder(name: string): void {
  const from = join(root, name);
  const to = join(outputDir, name);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyFolder('game');
copyFolder('screenshots');
writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, LIMITS));
console.log(`Sunburn: Port Solera written to ${outputDir}`);
