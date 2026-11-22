import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const out = path.join(root, "release", "TRISOLARIS-v1.6-source");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
const include = ["src", "public", "docs", "tests", "scripts"];
for (const dir of include) await fs.cp(path.join(root, dir), path.join(out, dir), { recursive: true });
for (const file of ["index.html", "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "README.md", ".gitignore"]) {
  try { await fs.cp(path.join(root, file), path.join(out, file)); } catch {}
}
console.log("copied", out);
