import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const out = path.join(root, "release", "TRISOLARIS-v1.7-source");
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
for (const dir of ["src", "public", "docs", "tests", "scripts"]) await fs.cp(path.join(root, dir), path.join(out, dir), { recursive: true });
for (const f of ["index.html", "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "README.md", ".gitignore"]) {
  try { await fs.cp(path.join(root, f), path.join(out, f)); } catch {}
}
console.log("copied", out);
