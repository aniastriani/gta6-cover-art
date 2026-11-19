// Vice City Nights — the entry program.
//
// Run with Node 22 or newer, standard library only, nothing to install
// and no build step:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// It hands the entry in: the app/ folder (the whole offline web app) and
// screenshots/ (the 3 or 4 screenshots of it) are copied from beside this
// file into the output directory, and a dossier.json is written there with
// buildDossier from the vendored make.fun library, so the judge can read
// the app and its screenshots. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output; inside the grader it is unset and /output is
// used. The program is deterministic: two runs over the same tree write
// the same dossier bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyFolder(folder: string): void {
  const from = join(repoRoot, folder);
  if (!existsSync(from)) return;
  cpSync(from, join(outputDir, folder), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
copyFolder('app');
copyFolder('screenshots');

// The caps the scorer enforces: at most 4 screenshots of 256 KiB, at most
// 993 entries and 48 MiB under app/, and no app/ path over 1000 bytes.
// Only text_max_bytes changes the dossier's bytes; the rest refuse an
// entry the scorer would refuse, so a bad tree fails loudly here.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
