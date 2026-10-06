import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  html: resolve(root, "index.html"),
  css: resolve(root, "assets", "experience-v7.css"),
  js: resolve(root, "assets", "experience-v7.js"),
  letter: resolve(root, "love-letter.json"),
};

const failures = [];
for (const [name, file] of Object.entries(files)) {
  if (!existsSync(file)) failures.push(`Missing experience artifact: ${name} -> ${file}`);
}

const html = existsSync(files.html) ? readFileSync(files.html, "utf8") : "";
const css = existsSync(files.css) ? readFileSync(files.css, "utf8") : "";
const js = existsSync(files.js) ? readFileSync(files.js, "utf8") : "";
const letter = existsSync(files.letter) ? readFileSync(files.letter, "utf8") : "";

for (const ref of ["./assets/experience-v7.css", "./assets/experience-v7.js"]) {
  if (!html.includes(ref)) failures.push(`index.html is missing ${ref}`);
}

for (const token of [
  "#experience-chrome",
  ".cx-button",
  ".cx-progress",
  "prefers-reduced-motion",
  "--pointer-x",
]) {
  if (!css.includes(token)) failures.push(`experience-v7.css is missing expected token: ${token}`);
}

for (const token of [
  "data-action=\"sound\"",
  "data-action=\"minimal\"",
  "data-action=\"restart\"",
  "MutationObserver",
  "matchMedia",
]) {
  if (!js.includes(token)) failures.push(`experience-v7.js is missing expected behavior: ${token}`);
}

try {
  JSON.parse(letter);
} catch (error) {
  failures.push(`Invalid love-letter.json: ${error.message}`);
}

if (letter && !letter.includes('"recipient": "Xuân Nghi"')) {
  failures.push('love-letter.json recipient invariant is missing.');
}

if (existsSync(files.js) && statSync(files.js).size > 100_000) {
  failures.push('experience-v7.js exceeds the 100 KB enhancement budget.');
}

if (existsSync(files.css) && statSync(files.css).size > 100_000) {
  failures.push('experience-v7.css exceeds the 100 KB enhancement budget.');
}

if (failures.length) {
  console.error("Experience verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Experience verification passed: controls, motion safety, pointer polish, and content wiring are present.");
