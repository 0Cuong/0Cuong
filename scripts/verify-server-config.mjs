import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const serverPath = resolve(root, "server.js");
const packagePath = resolve(root, "package.json");
const envExamplePath = resolve(root, ".env.example");

const failures = [];

if (!existsSync(serverPath)) failures.push("Missing server.js");
if (!existsSync(packagePath)) failures.push("Missing package.json");
if (!existsSync(envExamplePath)) failures.push("Missing .env.example");

let server = "";
let pkg = {};
let envExample = "";

if (existsSync(serverPath)) server = readFileSync(serverPath, "utf8");
if (existsSync(packagePath)) {
  try {
    pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch (error) {
    failures.push(`Invalid package.json: ${error.message}`);
  }
}
if (existsSync(envExamplePath)) envExample = readFileSync(envExamplePath, "utf8");

const requiredServerInvariants = [
  ["binds local development server by default", /const HOST = process\.env\.HOST \|\| ['"]127\.0\.0\.1['"]/],
  ["disables Express fingerprinting", /app\.disable\(['"]x-powered-by['"]\)/],
  ["disables browser camera access", /Permissions-Policy.*camera=\(\)/],
  ["disables microphone access", /Permissions-Policy.*microphone=\(\)/],
  ["restricts asset directories", /app\.use\(['"]\/assets['"]/],
  ["restricts portrait directory", /app\.use\(['"]\/portrait['"]/],
  ["restricts music directory", /app\.use\(['"]\/music['"]/],
  ["does not expose hidden dotfiles", /dotfiles:\s*['"]deny['"]/],
  ["returns 404 for extension-bearing unknown routes", /path\.extname\(req\.path\)/],
  ["uses no-cache for runtime JSON", /Cache-Control['"]:\s*['"]no-cache['"]/],
  ["handles graceful SIGINT shutdown", /process\.on\(['"]SIGINT['"]/],
  ["handles graceful SIGTERM shutdown", /process\.on\(['"]SIGTERM['"]/],
];

for (const [name, pattern] of requiredServerInvariants) {
  if (!pattern.test(server)) failures.push(`server.js invariant missing: ${name}`);
}

if (pkg?.dependencies?.express !== "4.22.3") {
  failures.push(`Expected Express 4.22.3, found ${pkg?.dependencies?.express ?? "missing"}`);
}

const envLines = new Set(
  envExample
    .split(/\r?\n/)
    .map((line) => line.trim().split("=")[0])
    .filter(Boolean),
);

for (const variable of ["PORT", "HOST"]) {
  if (!envLines.has(variable)) failures.push(`.env.example is missing ${variable}`);
}

if (failures.length) {
  console.error("Server configuration verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Server configuration verification passed.");
