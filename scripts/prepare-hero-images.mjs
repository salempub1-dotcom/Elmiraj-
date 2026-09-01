import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = path.join(root, 'hero-final-parts');
const outDir = path.join(root, 'public', 'images');

fs.mkdirSync(outDir, { recursive: true });

function rebuild(prefix, output) {
  const files = fs
    .readdirSync(partsDir)
    .filter(name => name.startsWith(`${prefix}.part`))
    .sort();

  if (!files.length) {
    throw new Error(`Missing hero image parts for ${prefix}`);
  }

  const base64 = files
    .map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim())
    .join('');

  const data = Buffer.from(base64, 'base64');
  fs.writeFileSync(path.join(outDir, output), data);
  console.log(`Prepared ${output} (${data.length} bytes)`);
}

rebuild('mobile', 'hero-mobile-classroom.webp');
rebuild('desktop', 'hero-desktop-classroom.webp');
