import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const bundlePath = resolve(root, "assets", "index-wDCBoduc.js");
const cssPath = resolve(root, "assets", "index-cyapdwvW.css");
const htmlPath = resolve(root, "index.html");

const failures = [];

for (const file of [bundlePath, cssPath, htmlPath]) {
  if (!existsSync(file)) failures.push(`Missing required intro artifact: ${file}`);
}

const bundle = existsSync(bundlePath) ? readFileSync(bundlePath, "utf8") : "";
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";

const jsInvariants = [
  ["WaitingScreen uses the dedicated intro hero", /cO=Er\.memo\(\(\{onStart:i,recipient:e,shouldReduceMotion:t\}\)/],
  ["Intro uses a semantic button", /type:"button".*className:"intro-hero"/],
  ["Recipient is injected into the intro", /recipient:i\.recipient/],
  ["Reduced-motion state reaches the intro", /shouldReduceMotion:!!c/],
  ["Existing start action is preserved", /Click to begin the journey/],
  ["No old role=button workaround remains", !/role:"button".*waiting-screen/.test(bundle)],
];

for (const [name, check] of jsInvariants) {
  const ok = typeof check === "boolean" ? check : check.test(bundle);
  if (!ok) failures.push(`Intro JS invariant failed: ${name}`);
}

const cssInvariants = [
  ["Hero layout", /\.intro-hero\{[^}]*min-height:100vh/],
  ["Hero hierarchy", /\.intro-hero__title-name\{[^}]*font-size:clamp/],
  ["Hero visual", /\.intro-hero__ring--outer/],
  ["CTA hover", /\.intro-hero:hover \.intro-hero__cta/],
  ["Keyboard focus", /\.intro-hero:focus-visible \.intro-hero__cta/],
  ["Tablet breakpoint", /@media \(max-width:900px\)/],
  ["Mobile breakpoint", /@media \(max-width:600px\)/],
  ["Reduced motion", /@media \(prefers-reduced-motion:reduce\)/],
  ["No horizontal overflow introduced by hero", !/\.intro-hero\{[^}]*width:100vw/.test(css)],
];

for (const [name, check] of cssInvariants) {
  const ok = typeof check === "boolean" ? check : check.test(css);
  if (!ok) failures.push(`Intro CSS invariant failed: ${name}`);
}

if (!html.includes("nebula-v6")) {
  failures.push("index.html is missing the intro cache-busting version nebula-v6.");
}

const bundleBytes = statSync(bundlePath).size;
if (bundleBytes > 1_600_000) {
  failures.push(`Main JS bundle exceeds the repository guardrail: ${bundleBytes} bytes.`);
}

if (failures.length) {
  console.error("Intro verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Intro verification passed: semantic hero, hierarchy, responsive states, focus/reduced-motion, and cache version; bundle ${bundleBytes} bytes.`);
