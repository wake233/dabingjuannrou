/**
 * Listen Paint esbuild build script.
 *
 * Bundles the art engine adapter layer into a single ESM file
 * for browser consumption. Each adapter wraps an open-source
 * library behind a deterministic, controlled interface.
 *
 * Usage:
 *   node build.js          # one-shot build
 *   node build.js --watch  # watch mode for development
 */

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(ROOT, "lib", "index.js");
const OUTDIR = resolve(ROOT, "static", "lib");
const OUTFILE = resolve(OUTDIR, "art-engine.js");

if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive: true });

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: [ENTRY],
  bundle: true,
  format: "esm",
  outfile: OUTFILE,
  platform: "browser",
  target: ["es2020"],
  sourcemap: true,
  minifySyntax: true,
  banner: {
    js: `/* Listen Paint Art Engine v4 — bundled at ${new Date().toISOString()} */`
  },
  footer: {
    js: `/* Art engine adapters ready. */`
  },
  logLevel: "info",
  metafile: true
};

async function build() {
  try {
    const result = await esbuild.build(opts);
    if (result.metafile) {
      const inputs = Object.keys(result.metafile.inputs);
      console.log(`Art engine bundled: ${inputs.length} modules -> ${OUTFILE}`);
    }
    // Write license inventory to build output
    generateLicenseReport();
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

function generateLicenseReport() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
  const deps = { ...pkg.dependencies };
  // esbuild is a build tool, not shipped to browser
  delete deps.esbuild;

  const licenses = {
    "perfect-freehand": { name: "perfect-freehand", version: "1.2.2", license: "MIT", source: "https://github.com/steveruizok/perfect-freehand", usage: "Natural pen strokes with pressure and taper simulation", modification: "Wrapped behind deterministic seed-driven interface; all random effects are seeded" },
    "d3-shape": { name: "d3-shape", version: "3.2.0", license: "ISC", source: "https://github.com/d3/d3-shape", usage: "Organic curve, contour and area path generation", modification: "Curve factory wrappers with coordinate clamping" },
    "bezier-js": { name: "bezier-js", version: "6.1.4", license: "MIT", source: "https://github.com/Pomax/bezierjs", usage: "Bezier curve sampling, tangent, offset and intersection", modification: "Deterministic sampling wrappers with bounded iteration" },
    "culori": { name: "culori", version: "4.0.1", license: "MIT", source: "https://github.com/Evercoder/culori", usage: "Perceptual color space palette generation, lightness and warm/cool relationships", modification: "Seed-driven palette generation; palette caching for stability" },
    "simplex-noise": { name: "simplex-noise", version: "4.0.3", license: "MIT", source: "https://github.com/jwagner/simplex-noise.js", usage: "Deterministic paper grain, ink texture, material and natural contour perturbation", modification: "Seeded noise factory with coordinate domain clamping" }
  };

  const inventory = {
    generated: new Date().toISOString(),
    project: "listen-paint",
    version: "4.0.0",
    license: "MIT",
    dependencies: Object.entries(deps).map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~]/, ""),
      license: licenses[name]?.license || "Unknown",
      source: licenses[name]?.source || "",
      usage: licenses[name]?.usage || "",
      modification: licenses[name]?.modification || ""
    }))
  };

  writeFileSync(
    resolve(OUTDIR, "license-inventory.json"),
    JSON.stringify(inventory, null, 2),
    "utf-8"
  );

  // Also write a markdown version
  let md = `# License Inventory — Listen Paint Art Engine v4\n\n`;
  md += `Generated: ${inventory.generated}\n\n`;
  md += `| Dependency | Version | License | Source | Usage |\n`;
  md += `| --- | --- | --- | --- | --- |\n`;
  for (const dep of inventory.dependencies) {
    md += `| ${dep.name} | ${dep.version} | ${dep.license} | ${dep.source} | ${dep.usage} |\n`;
  }
  md += `\nAll third-party assets are bundled locally. The application makes no runtime external requests for fonts, scripts, or assets.\n`;

  writeFileSync(resolve(OUTDIR, "license-inventory.md"), md, "utf-8");
  console.log("License inventory written.");
}

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log("Watching lib/ for changes...");
} else {
  await build();
}
