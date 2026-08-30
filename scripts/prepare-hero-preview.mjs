import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const partsDir = path.join(root, 'public', 'hero-preview-parts');
const outputDir = path.join(root, 'public', 'assets', 'hero');

async function restore(prefix, outputName) {
  const files = (await readdir(partsDir))
    .filter(name => name.startsWith(prefix + '.part'))
    .sort();

  if (files.length === 0) {
    throw new Error(`Missing hero preview parts for ${prefix}`);
  }

  const chunks = await Promise.all(
    files.map(name => readFile(path.join(partsDir, name), 'utf8')),
  );

  const buffer = Buffer.from(chunks.join(''), 'base64');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, outputName), buffer);
  console.log(`[hero-preview] restored ${outputName} (${buffer.length} bytes)`);
}

await restore('previewvideo', 'al_miraj_hero_preview.mp4');
await restore('previewposter', 'al_miraj_hero_preview_poster.webp');
await restore('herov2', 'al_miraj_hero_bg.mp4');
await restore('posterv2', 'al_miraj_hero_bg_poster.webp');
