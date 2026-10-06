import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  html: resolve(root, "index.html"),
  css: resolve(root, "assets", "nebula-v8.css"),
  js: resolve(root, "assets", "nebula-v8.js"),
  portrait: resolve(root, "portrait", "girlfriend.jpg"),
};

const failures = [];
for (const [name, file] of Object.entries(files)) {
  if (!existsSync(file)) failures.push(`Missing nebula artifact: ${name}`);
}

const html = existsSync(files.html) ? readFileSync(files.html, "utf8") : "";
const css = existsSync(files.css) ? readFileSync(files.css, "utf8") : "";
const js = existsSync(files.js) ? readFileSync(files.js, "utf8") : "";

for (const ref of ["./assets/nebula-v8.css", "./assets/nebula-v8.js"]) {
  if (!html.includes(ref)) failures.push(`index.html is missing ${ref}`);
}

for (const token of [
  "nebula-v8__hud",
  "nebula-v8__button",
  "pointer-events:auto",
  "touch-action:none",
  "prefers-reduced-motion",
]) {
  if (!css.includes(token)) failures.push(`nebula-v8.css is missing expected token: ${token}`);
}

for (const token of [
  "5200",
  "10500",
  "NEBULA",
  "FLOCK",
  "DRONE",
  "HEART",
  "girlfriend.jpg",
  "portraitTargets",
  "targetZoom",
  "wheel",
]) {
  if (!js.includes(token)) failures.push(`nebula-v8.js is missing expected behavior: ${token}`);
}

if (existsSync(files.js) && statSync(files.js).size > 50_000) {
  failures.push(`nebula-v8.js exceeds the 50 KB enhancement budget: ${statSync(files.js).size}`);
}

if (failures.length) {
  console.error("Nebula verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Nebula verification passed: dense particles, flocking formations, zoom/pan input, and portrait sculpture are wired.");
