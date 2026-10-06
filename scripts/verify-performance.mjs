import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const bundlePath = resolve(root, "assets", "index-wDCBoduc.js");
const htmlPath = resolve(root, "index.html");

const failures = [];
const bundle = readFileSync(bundlePath, "utf8");
const html = readFileSync(htmlPath, "utf8");

const expectedBudget =
  'function BY(){const{cores:i,mem:e,isMobile:t}=zY();return t?6e5:e<=4||i<=4?15e5:e<=8||i<=8?25e5:35e5}';

if (!bundle.includes(expectedBudget)) {
  failures.push("Portrait particle budget is not using the verified device-tier caps.");
}

if (!html.includes("nebula-v6")) {
  failures.push("index.html is missing the cache-busting version for the performance-tuned bundle.");
}

const bundleBytes = statSync(bundlePath).size;
const maxBundleBytes = 1_600_000;
if (bundleBytes > maxBundleBytes) {
  failures.push(`Main JS bundle is ${bundleBytes} bytes; expected <= ${maxBundleBytes} bytes.`);
}

const oldHighEndBytes = 15_000_000 * 56;
const newHighEndBytes = 3_500_000 * 56;
const reduction = Math.round((1 - newHighEndBytes / oldHighEndBytes) * 100);

if (failures.length) {
  console.error("Performance verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Performance guardrails passed: portrait CPU attribute budget reduced ${reduction}% at the previous high-end ceiling; bundle size ${bundleBytes} bytes.`,
);
