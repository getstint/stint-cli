import { chmodSync, readFileSync, writeFileSync } from "node:fs";

const outfile = "dist/stint.mjs";

const result = await Bun.build({
  entrypoints: ["src/cli.ts"],
  outdir: "dist",
  naming: "stint.mjs",
  target: "node",
  format: "esm",
  minify: true,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const body = readFileSync(outfile, "utf8").replace(/^#!.*\n/, "");
writeFileSync(outfile, `#!/usr/bin/env node\n${body}`);
if (process.platform !== "win32") chmodSync(outfile, 0o755);
console.info(`Built ${outfile} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB)`);
