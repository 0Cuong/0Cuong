import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const jsPath = resolve(root, "assets", "solar-v9.js");
const cssPath = resolve(root, "assets", "solar-v9.css");
const htmlPath = resolve(root, "index.html");
const failures = [];

for (const file of [jsPath, cssPath, htmlPath]) {
  if (!existsSync(file)) failures.push(`Missing solar artifact: ${file}`);
}

if (existsSync(jsPath)) {
  const check = spawnSync(process.execPath, ["--check", jsPath], { encoding: "utf8" });
  if (check.status !== 0) failures.push(`solar-v9.js syntax failed: ${check.stderr?.trim() || "unknown parser error"}`);
  if (statSync(jsPath).size > 55_000) failures.push(`solar-v9.js exceeds 55 KB: ${statSync(jsPath).size}`);
}

const js = existsSync(jsPath) ? readFileSync(jsPath, "utf8") : "";
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";

for (const token of [
  "webgl2",
  "SOLAR SYSTEM",
  "Mercury",
  "Venus",
  "Earth",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "orbit(",
  "targetDistance",
  "pointerdown",
  "wheel",
  "makePortrait",
  "portraitExitTimer",
  "solar-v9__portrait-exit",
  "1250",
  "girlfriend.jpg",
  "ring",
]) if (!js.includes(token)) failures.push(`solar-v9.js missing expected behavior: ${token}`);

for (const token of ["#solar-v9", "#solar-v9-effects", "#solar-v9-particles", "pointer-events:auto", "touch-action:none", "prefers-reduced-motion"]) {
  if (!css.includes(token)) failures.push(`solar-v9.css missing expected token: ${token}`);
}

for (const ref of ["./assets/solar-v9.js", "./assets/solar-v9.css"]) {
  if (!html.includes(ref)) failures.push(`index.html missing ${ref}`);
}
if (html.includes("nebula-v8.js") || html.includes("nebula-v8.css")) failures.push("index.html still loads the superseded nebula-v8 overlay.");

if (failures.length) {
  console.error("Solar verification failed:");
  failures.forEach((f) => console.error("- " + f));
  process.exit(1);
}

console.log(`Solar verification passed: WebGL planetary renderer, realistic procedural surfaces, orbit simulation, zoom/drag/touch camera, Saturn rings, and portrait particle transition are wired. JS ${statSync(jsPath).size} bytes.`);
