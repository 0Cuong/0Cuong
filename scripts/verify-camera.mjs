import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  js: resolve(root, "assets/camera-interaction.js"),
  css: resolve(root, "assets/camera-interaction.css"),
  scrollTrigger: resolve(root, "assets/ScrollTrigger.min.js"),
  html: resolve(root, "index.html"),
};

const failures = [];
for (const [name, file] of Object.entries(files)) {
  if (!existsSync(file)) failures.push(`Missing ${name}: ${file}`);
}

for (const file of [files.js, files.scrollTrigger]) {
  if (!existsSync(file)) continue;
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures.push(`JavaScript syntax check failed: ${file}${result.stderr ? ` — ${result.stderr.trim()}` : ""}`);
  }
}

if (existsSync(files.js)) {
  const source = readFileSync(files.js, "utf8");
  const required = [
    "navigator.mediaDevices.getUserMedia",
    "audio: false",
    "CAMERA_STATES.denied",
    "CAMERA_STATES.unavailable",
    "CAMERA_STATES.unsupported",
    "track.stop()",
    "pagehide",
    "beforeunload",
    "__UNIVERSE_GSAP__",
    "gsap.context(",
    "ScrollTrigger.create",
    "prefers-reduced-motion: reduce",
    "./assets/ScrollTrigger.min.js",
  ];
  for (const token of required) {
    if (!source.includes(token)) failures.push(`Camera source missing required behavior: ${token}`);
  }
  if (/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(source)) {
    failures.push("Camera module contains an unexpected network transport API.");
  }
}

if (existsSync(files.html)) {
  const html = readFileSync(files.html, "utf8");
  for (const ref of ["./assets/camera-interaction.css", "./assets/camera-interaction.js"]) {
    if (!html.includes(ref)) failures.push(`index.html is missing camera asset: ${ref}`);
  }
}

if (failures.length) {
  console.error("Camera verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Camera + GSAP + ScrollTrigger verification passed.");
