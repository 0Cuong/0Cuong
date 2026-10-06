import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bundlePath = path.join(root, "assets", "index-wDCBoduc.js");
const htmlPath = path.join(root, "index.html");

const bundle = fs.readFileSync(bundlePath, "utf8");
const html = fs.readFileSync(htmlPath, "utf8");

const required = [
  ["4-arm spiral seed", bundle.includes("const arm=Math.floor(Math.random()*4)")],
  ["spiral cohesion field", bundle.includes("float sector=6.2831853/4.0")],
  ["depth spring", bundle.includes("tSeedPositions") && bundle.includes("depthSpring")],
  ["restrained galaxy alpha", bundle.includes("layerOpacity=vLayer<0.5?0.075") && bundle.includes("alpha*0.78")],
  ["soft galaxy point sizing", bundle.includes("clamp(pointScale,0.55,20.0)")],
  ["soft solar starfield", bundle.includes("count:1800,factor:2") && bundle.includes("speed:.16")],
  ["reduced solar clutter", bundle.includes("const i=se.useRef(null),e=1800")],
  ["soft sun lighting", bundle.includes("intensity:520")],
  ["soft bloom threshold", bundle.includes("luminanceThreshold:.58") && bundle.includes("luminanceSmoothing:.74")],
  ["Pages asset cache v5", html.includes("nebula-v5")]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error("Visual pass verification failed:", failed.join(", "));
  process.exit(1);
}

console.log(`Visual pass verified: ${required.length} invariants passed.`);
