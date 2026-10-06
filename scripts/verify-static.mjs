import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'assets/index-wDCBoduc.js',
  'assets/index-cyapdwvW.css',
  'assets/experience-v7.js',
  'assets/experience-v7.css',
  'assets/solar-v9.js',
  'assets/solar-v9.css',
  'portrait/girlfriend.jpg',
  'music/song.mp3',
  'love-letter.json',
  'metadata.json',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`Missing required file: ${file}`);
}

for (const file of ['love-letter.json', 'metadata.json']) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  try {
    JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`Invalid JSON in ${file}: ${error.message}`);
  }
}

const indexPath = resolve(root, 'index.html');
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  const expectedRefs = [
    './assets/index-wDCBoduc.js',
    './assets/index-cyapdwvW.css',
    './assets/experience-v7.js',
    './assets/experience-v7.css',
    './assets/solar-v9.js',
    './assets/solar-v9.css',
  ];

  for (const ref of expectedRefs) {
    if (!html.includes(ref)) failures.push(`index.html is missing ${ref}`);
  }

  if (html.includes('src="/assets/') || html.includes('href="/assets/')) {
    failures.push('index.html still contains root-relative /assets/ URLs that break project Pages paths.');
  }

  if (!/<html[^>]+lang="[^"]+"/i.test(html)) {
    failures.push('index.html is missing an explicit language attribute.');
  }

  if (!/<meta[^>]+name="description"/i.test(html)) {
    failures.push('index.html is missing a description meta tag.');
  }

  if (!/<noscript>/i.test(html)) {
    failures.push('index.html is missing a no-JavaScript fallback.');
  }
}

if (failures.length) {
  console.error('Static verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Static verification passed: ${requiredFiles.length} required files present and configuration checks passed.`);
